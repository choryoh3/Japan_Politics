import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client.ts";
import {
  CABINET_NAME_MAX_LENGTH,
  isAllowedSourceUrl,
  validateAppointmentInput,
  validateCabinetInput,
} from "./cabinet-input.ts";
import {
  createAppointment,
  createCabinet,
  deleteAppointment,
  updateAppointment,
  updateCabinet,
} from "./cabinet-write.ts";
import { runMigrations } from "./migrate.ts";
import { createPerson } from "./person-write.ts";
import { getCabinetDetail, getPersonProfile, listCabinets } from "./queries.ts";
import { seedInitialData } from "./seed.ts";
import { tenuresOverlap } from "./tenure.ts";
import type { AppointmentInput } from "./cabinet-input.ts";

let dir: string;
let db: Db;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "jp-cabinet-"));
  db = createDb(`file:${join(dir, "test.db")}`);
  await runMigrations(db);
  await seedInitialData(db);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** 内閣の入力の検証結果から、エラーコードだけを取り出す。 */
function cabinetErrors(raw: unknown) {
  const result = validateCabinetInput(raw);
  return result.ok ? null : result.errors;
}

/** 閣僚人事の入力の検証結果から、エラーコードだけを取り出す。 */
function appointmentErrors(raw: unknown) {
  const result = validateAppointmentInput(raw);
  return result.ok ? null : result.errors;
}

/** 正しい閣僚人事の入力（テストごとに一部だけ上書きする）。 */
function appointment(overrides: Record<string, unknown> = {}) {
  return { postName: "内閣官房長官", personId: 1, ...overrides };
}

/** 閣僚人事の入力を検証して、通ったものを返す（通らなければテストを失敗させる）。 */
function valid(overrides: Record<string, unknown> = {}): AppointmentInput {
  const result = validateAppointmentInput(appointment(overrides));
  if (!result.ok) throw new Error(`入力が不正: ${JSON.stringify(result.errors)}`);
  return result.value;
}

/** テスト用の人物を登録して ID を返す。 */
async function newPerson(name: string): Promise<number> {
  const result = await createPerson(db, { name, kana: "てすと", birthDate: null, memo: null });
  if (!result.ok) throw new Error("人物を登録できませんでした");
  return result.id;
}

/** テスト用の内閣を登録して ID を返す。 */
async function newCabinet(name: string, startDate: string, endDate: string | null = null) {
  const result = await createCabinet(db, { name, startDate, endDate });
  if (!result.ok) throw new Error("内閣を登録できませんでした");
  return result.id;
}

describe("内閣名の検証（許可リスト方式）", () => {
  it("空・空白だけ・見えない文字だけ・記号だけは nameRequired", () => {
    for (const name of [
      "",
      "   ",
      "\u3000\u3000",
      "\u200B",
      "\u3164",
      "\u00AD",
      "・",
      "--",
      "・ ・",
      undefined,
      null,
      123,
    ]) {
      expect(cabinetErrors({ name, startDate: "2025-01-01" })?.name, String(name)).toBe(
        "nameRequired",
      );
    }
  });

  it("50 文字は通り、51 文字は nameTooLong", () => {
    const ok = validateCabinetInput({
      name: "あ".repeat(CABINET_NAME_MAX_LENGTH),
      startDate: "2025-01-01",
    });
    expect(ok.ok).toBe(true);
    expect(
      cabinetErrors({ name: "あ".repeat(CABINET_NAME_MAX_LENGTH + 1), startDate: "2025-01-01" })
        ?.name,
    ).toBe("nameTooLong");
  });

  it("NUL・BEL・改行・タブ・見えない文字・絵文字・記号を含む内閣名は nameInvalidChar", () => {
    for (const name of [
      "第1次\u0000内閣",
      "第1次\u0007内閣",
      "第1次\n内閣",
      "第1次\t内閣",
      "第1次\u200B内閣",
      "第1次\u202E内閣",
      "第1次\u00A0内閣",
      "第1次😀内閣",
      "<script>内閣",
      "第1次/内閣",
      "第1次'内閣",
      "́第1次内閣",
    ]) {
      expect(cabinetErrors({ name, startDate: "2025-01-01" })?.name, JSON.stringify(name)).toBe(
        "nameInvalidChar",
      );
    }
  });

  it("実在の内閣名は通り、連続する半角スペースは 1 つに畳まれ、前後の空白は取り除かれる", () => {
    for (const name of ["第2次岸田改造内閣", "第1次安倍・麻生内閣", "Cabinet-1", "菅内閣"]) {
      const result = validateCabinetInput({ name, startDate: "2025-01-01" });
      expect(result.ok && result.value.name).toBe(name);
    }
    const spaced = validateCabinetInput({ name: "  第3次   内閣  ", startDate: "2025-01-01" });
    expect(spaced.ok && spaced.value.name).toBe("第3次 内閣");
  });

  it("NFC で同じになる内閣名は同じ文字列にそろう（か＋濁点 = が）", () => {
    const result = validateCabinetInput({ name: "が内閣", startDate: "2025-01-01" });
    expect(result.ok && result.value.name).toBe("が内閣");
  });
});

describe("内閣の日付の検証", () => {
  it("発足日は必須で、実在する日付だけ（2 月 30 日などは拒否）", () => {
    expect(cabinetErrors({ name: "A内閣" })?.startDate).toBe("startDateRequired");
    expect(cabinetErrors({ name: "A内閣", startDate: "" })?.startDate).toBe("startDateRequired");
    for (const startDate of [
      "2025-02-30",
      "2025-13-01",
      "2025/01/01",
      "20250101",
      "abc",
      "2023-02-29",
    ]) {
      expect(cabinetErrors({ name: "A内閣", startDate })?.startDate, startDate).toBe(
        "startDateInvalid",
      );
    }
    expect(validateCabinetInput({ name: "A内閣", startDate: "2024-02-29" }).ok).toBe(true);
    expect(
      cabinetErrors({ name: "A内閣", startDate: "2025-01-01", endDate: "2025-02-30" })?.endDate,
    ).toBe("endDateInvalid");
  });

  it("終了日は空欄なら null。発足日より前は endDateBeforeStart、同じ日は通る", () => {
    const empty = validateCabinetInput({ name: "A内閣", startDate: "2025-01-01", endDate: "" });
    expect(empty.ok && empty.value.endDate).toBeNull();
    expect(
      cabinetErrors({ name: "A内閣", startDate: "2025-01-02", endDate: "2025-01-01" })?.endDate,
    ).toBe("endDateBeforeStart");
    expect(
      validateCabinetInput({ name: "A内閣", startDate: "2025-01-01", endDate: "2025-01-01" }).ok,
    ).toBe(true);
  });
});

describe("閣僚人事の入力の検証", () => {
  it("役職は用意した一覧からだけ選べる", () => {
    expect(appointmentErrors(appointment({ postName: "" }))?.postName).toBe("postRequired");
    expect(appointmentErrors(appointment({ postName: undefined }))?.postName).toBe("postRequired");
    expect(appointmentErrors(appointment({ postName: "官房長官" }))?.postName).toBe("postInvalid");
    expect(appointmentErrors(appointment({ postName: "内閣官房長官\u0000" }))?.postName).toBe(
      "postInvalid",
    );
    expect(validateAppointmentInput(appointment()).ok).toBe(true);
  });

  it("人物 ID は 1 以上の整数（数字の文字列も可）だけ", () => {
    for (const personId of [undefined, null, "", "abc", 0, -1, 1.5, "1.5", Number.NaN, 1e20]) {
      expect(appointmentErrors(appointment({ personId }))?.personId, String(personId)).toBe(
        "personRequired",
      );
    }
    const result = validateAppointmentInput(appointment({ personId: "12" }));
    expect(result.ok && result.value.personId).toBe(12);
  });

  it("就任日・退任日は実在する日付だけで、退任日が就任日より前なら拒否する。端（同日）は通る", () => {
    expect(appointmentErrors(appointment({ startDate: "2025-02-30" }))?.startDate).toBe(
      "startDateInvalid",
    );
    expect(appointmentErrors(appointment({ endDate: "2025-02-30" }))?.endDate).toBe(
      "endDateInvalid",
    );
    expect(
      appointmentErrors(appointment({ startDate: "2025-03-02", endDate: "2025-03-01" }))?.endDate,
    ).toBe("endDateBeforeStart");
    expect(
      validateAppointmentInput(appointment({ startDate: "2025-03-01", endDate: "2025-03-01" })).ok,
    ).toBe(true);
    const empty = validateAppointmentInput(appointment({ startDate: "", endDate: "  " }));
    expect(empty.ok && [empty.value.startDate, empty.value.endDate]).toEqual([null, null]);
  });

  it("出典 URL は http(s) の URL だけ。javascript: data: file: などは拒否する", () => {
    for (const sourceUrl of [
      "abc",
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "ftp://example.com/a",
      "//example.com/a",
      "https://",
      "http:///a",
      "https:example.com",
      "https://exa mple.com/",
      "https://example.com/a b",
      "https://example.com/\u0000",
      "https://example.com/\u0007",
      "https://example.com/a\nb",
      "https://example.com/\u200B",
      "https://example.com/a\u00A0b",
      "https://user:pass@example.com/",
      "https://example.com/%zz",
      "https://example.com/<a>",
      'https://example.com/"',
      "https://example.com/\\a",
      `https://example.com/${"a".repeat(2000)}`,
    ]) {
      expect(
        appointmentErrors(appointment({ sourceUrl }))?.sourceUrl,
        JSON.stringify(sourceUrl),
      ).toMatch(/^sourceUrl(Invalid|TooLong)$/);
    }
    expect(appointmentErrors(appointment({ sourceUrl: "abc" }))?.sourceUrl).toBe(
      "sourceUrlInvalid",
    );
    expect(
      appointmentErrors(appointment({ sourceUrl: `https://example.com/${"a".repeat(2000)}` }))
        ?.sourceUrl,
    ).toBe("sourceUrlTooLong");
  });

  it("出典 URL は前後の空白を除いて保存し、空欄は空文字（出典なし）になる", () => {
    for (const sourceUrl of [
      "https://example.com/source",
      "http://example.com",
      "HTTPS://EXAMPLE.COM/A?b=1#c",
      "https://ja.wikipedia.org/wiki/安倍晋三",
      "https://example.com/a%20b",
    ]) {
      expect(isAllowedSourceUrl(sourceUrl), sourceUrl).toBe(true);
    }
    const trimmed = validateAppointmentInput(
      appointment({ sourceUrl: "  https://example.com/source \n" }),
    );
    expect(trimmed.ok && trimmed.value.sourceUrl).toBe("https://example.com/source");
    const empty = validateAppointmentInput(
      appointment({ sourceUrl: "   ", sourceNote: undefined }),
    );
    expect(empty.ok && [empty.value.sourceUrl, empty.value.sourceNote]).toEqual(["", ""]);
  });

  it("出典メモは改行・タブを許し、制御文字・見えない文字は拒否し、1001 文字は拒否する", () => {
    const ok = validateAppointmentInput(appointment({ sourceNote: "テスト出典\n2行目\t終わり" }));
    expect(ok.ok).toBe(true);
    for (const sourceNote of [
      "a\u0000b",
      "a\u0007b",
      "a\u200Bb",
      "a\u202Eb",
      "a\uFFFCb",
      "a\u2800b",
    ]) {
      expect(
        appointmentErrors(appointment({ sourceNote }))?.sourceNote,
        JSON.stringify(sourceNote),
      ).toBe("sourceNoteInvalidChar");
    }
    expect(appointmentErrors(appointment({ sourceNote: "あ".repeat(1001) }))?.sourceNote).toBe(
      "sourceNoteTooLong",
    );
    expect(validateAppointmentInput(appointment({ sourceNote: "あ".repeat(1000) })).ok).toBe(true);
  });
});

describe("在任期間の重なりの判定", () => {
  it("退任日と次の就任日が同じ日なら重ならず、1 日でも食い込めば重なる", () => {
    const first = { start: "2025-01-01", end: "2025-06-30" };
    expect(tenuresOverlap(first, { start: "2025-06-30", end: null })).toBe(false);
    expect(tenuresOverlap({ start: "2025-06-30", end: null }, first)).toBe(false);
    expect(tenuresOverlap(first, { start: "2025-06-29", end: null })).toBe(true);
    expect(tenuresOverlap(first, { start: "2024-01-01", end: "2025-01-02" })).toBe(true);
    expect(tenuresOverlap(first, { start: "2025-01-01", end: "2025-01-01" })).toBe(true);
  });
});

describe("内閣の追加・修正", () => {
  it("追加した内閣が発足日の順の位置に入り、閣僚は 0 人", async () => {
    const id = await newCabinet("テスト用の古い内閣", "2020-09-10", "2020-09-15");
    const list = await listCabinets(db);
    const names = list.map((c) => c.name);
    expect(names.indexOf("テスト用の古い内閣")).toBe(names.length - 1);
    expect(list.map((c) => c.startDate)).toEqual(
      list
        .map((c) => c.startDate)
        .sort()
        .reverse(),
    );
    expect((await getCabinetDetail(db, id))?.roster).toEqual([]);
  });

  it("同じ内閣名（全角・半角・空白の違いを含む）は conflict、修正で自分の名前のままなら通る", async () => {
    const id = await newCabinet("第9次重複テスト内閣", "2026-01-01");
    for (const name of ["第9次重複テスト内閣", "第９次重複テスト内閣", "第9次 重複テスト内閣"]) {
      const result = await createCabinet(db, { name, startDate: "2026-02-01", endDate: null });
      expect(result, name).toEqual({
        ok: false,
        reason: "conflict",
        fields: { name: "nameDuplicate" },
      });
    }
    const same = await updateCabinet(db, id, {
      name: "第9次重複テスト内閣",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    expect(same).toEqual({ ok: true, id });
    const clash = await updateCabinet(db, id, {
      name: "菅内閣",
      startDate: "2026-01-01",
      endDate: null,
    });
    expect(clash).toMatchObject({ ok: false, reason: "conflict" });
  });

  it("存在しない内閣の修正は notFound", async () => {
    expect(
      await updateCabinet(db, 999999, { name: "なし", startDate: "2026-01-01", endDate: null }),
    ).toEqual({ ok: false, reason: "notFound" });
  });

  it("日付つきの人事が新しい期間の外に出る修正は拒否する", async () => {
    const cabinetId = await newCabinet("期間修正テスト内閣", "2026-03-01", "2026-09-30");
    const personId = await newPerson("期間修正テスト人物");
    const created = await createAppointment(
      db,
      cabinetId,
      valid({ personId, startDate: "2026-04-01", endDate: "2026-06-01" }),
    );
    expect(created.ok).toBe(true);
    const base = { name: "期間修正テスト内閣", startDate: "2026-03-01", endDate: "2026-09-30" };
    expect(await updateCabinet(db, cabinetId, { ...base, startDate: "2026-04-02" })).toMatchObject({
      ok: false,
      fields: { startDate: "appointmentBeforeStart" },
    });
    expect(await updateCabinet(db, cabinetId, { ...base, endDate: "2026-05-31" })).toMatchObject({
      ok: false,
      fields: { endDate: "appointmentAfterEnd" },
    });
    expect(await updateCabinet(db, cabinetId, { ...base, endDate: "2026-06-01" })).toEqual({
      ok: true,
      id: cabinetId,
    });
  });
});

describe("閣僚人事の追加・修正・削除", () => {
  it("追加した人事が名簿と人物の経歴に出て、出典 URL とメモが保存される", async () => {
    const cabinetId = await newCabinet("出典テスト内閣", "2026-04-01");
    const personId = await newPerson("出典テスト人物");
    const result = await createAppointment(
      db,
      cabinetId,
      valid({
        postName: "外務大臣",
        personId,
        startDate: "2026-04-02",
        sourceUrl: "https://example.com/source",
        sourceNote: "テスト出典",
      }),
    );
    expect(result.ok).toBe(true);
    const roster = (await getCabinetDetail(db, cabinetId))?.roster ?? [];
    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({
      postName: "外務大臣",
      personName: "出典テスト人物",
      sourceUrl: "https://example.com/source",
      sourceNote: "テスト出典",
    });
    const profile = await getPersonProfile(db, personId);
    expect(profile?.careers[0]).toMatchObject({
      cabinetName: "出典テスト内閣",
      startDate: "2026-04-02",
      sourceNote: "テスト出典",
    });
  });

  it("存在しない内閣・人物は拒否し、人物がいない人事は作られない", async () => {
    const cabinetId = await newCabinet("存在確認テスト内閣", "2026-05-01");
    expect(await createAppointment(db, 999999, valid({ personId: 1 }))).toEqual({
      ok: false,
      reason: "notFound",
    });
    expect(await createAppointment(db, cabinetId, valid({ personId: 999999 }))).toEqual({
      ok: false,
      reason: "invalid",
      fields: { personId: "personNotFound" },
    });
    expect((await getCabinetDetail(db, cabinetId))?.roster).toEqual([]);
  });

  it("就任日・退任日が内閣の期間外なら拒否し、期間の端（発足日・終了日）は通る", async () => {
    const cabinetId = await newCabinet("期間チェックテスト内閣", "2026-06-10", "2026-06-20");
    const a = await newPerson("期間チェック甲");
    expect(
      await createAppointment(db, cabinetId, valid({ personId: a, startDate: "2026-06-09" })),
    ).toEqual({
      ok: false,
      reason: "invalid",
      fields: { startDate: "startOutsideCabinet" },
    });
    expect(
      await createAppointment(db, cabinetId, valid({ personId: a, startDate: "2026-06-21" })),
    ).toMatchObject({
      fields: { startDate: "startOutsideCabinet" },
    });
    expect(
      await createAppointment(db, cabinetId, valid({ personId: a, endDate: "2026-06-21" })),
    ).toMatchObject({
      fields: { endDate: "endOutsideCabinet" },
    });
    expect(
      await createAppointment(db, cabinetId, valid({ personId: a, endDate: "2026-06-09" })),
    ).toMatchObject({
      fields: { endDate: "endOutsideCabinet" },
    });
    expect((await getCabinetDetail(db, cabinetId))?.roster).toEqual([]);
    const edge = await createAppointment(
      db,
      cabinetId,
      valid({ personId: a, startDate: "2026-06-10", endDate: "2026-06-20" }),
    );
    expect(edge.ok).toBe(true);
  });

  it("単独の役職は在任期間が重ならない。退任日と次の就任日が同日ならよい。特命担当は重なってよい", async () => {
    const cabinetId = await newCabinet("重なりテスト内閣", "2026-07-01", "2026-12-31");
    const [a, b, c] = [
      await newPerson("重なり甲"),
      await newPerson("重なり乙"),
      await newPerson("重なり丙"),
    ];
    const first = await createAppointment(
      db,
      cabinetId,
      valid({ personId: a, startDate: "2026-07-01", endDate: "2026-09-30" }),
    );
    expect(first.ok).toBe(true);
    // 在任者のいる期間（日付なし = 内閣の全期間）は拒否
    expect(await createAppointment(db, cabinetId, valid({ personId: b }))).toEqual({
      ok: false,
      reason: "conflict",
      fields: { postName: "postOverlap" },
    });
    // 1 日でも食い込めば拒否
    expect(
      await createAppointment(db, cabinetId, valid({ personId: b, startDate: "2026-09-29" })),
    ).toMatchObject({ reason: "conflict", fields: { postName: "postOverlap" } });
    // 退任日と同日の就任は通る
    const next = await createAppointment(
      db,
      cabinetId,
      valid({ personId: b, startDate: "2026-09-30" }),
    );
    expect(next.ok).toBe(true);
    // 3 人目は、後任の期間（2026-09-30 から）と重なるので拒否
    expect(
      await createAppointment(db, cabinetId, valid({ personId: c, startDate: "2026-11-01" })),
    ).toMatchObject({ reason: "conflict", fields: { postName: "postOverlap" } });

    // 特命担当大臣は重なってよい
    for (const personId of [a, b]) {
      const result = await createAppointment(
        db,
        cabinetId,
        valid({ postName: "少子化対策担当大臣", personId }),
      );
      expect(result.ok).toBe(true);
    }
    // 同じ人物を同じ役職に二重登録はできない
    expect(
      await createAppointment(
        db,
        cabinetId,
        valid({ postName: "少子化対策担当大臣", personId: a }),
      ),
    ).toEqual({ ok: false, reason: "conflict", fields: { personId: "appointmentDuplicate" } });
  });

  it("人事を修正でき、自分自身との重なりは無視され、他の内閣の人事 ID は notFound で変更されない", async () => {
    const cabinetId = await newCabinet("修正テスト内閣", "2026-01-01", "2026-12-31");
    const otherCabinetId = await newCabinet("修正テスト別内閣", "2026-01-01", "2026-12-31");
    const a = await newPerson("修正テスト甲");
    const b = await newPerson("修正テスト乙");
    const created = await createAppointment(
      db,
      cabinetId,
      valid({ personId: a, sourceNote: "元のメモ" }),
    );
    if (!created.ok) throw new Error("追加できませんでした");
    const other = await createAppointment(db, otherCabinetId, valid({ personId: b }));
    if (!other.ok) throw new Error("追加できませんでした");

    // 自分自身の期間と重なっても、自分の修正は通る
    const edited = await updateAppointment(
      db,
      cabinetId,
      created.id,
      valid({ personId: a, endDate: "2026-08-01", sourceNote: "新しいメモ" }),
    );
    expect(edited).toEqual({ ok: true, id: created.id });
    const row = (await getCabinetDetail(db, cabinetId))?.roster[0];
    expect(row).toMatchObject({ endDate: "2026-08-01", sourceNote: "新しいメモ" });
    expect((await getPersonProfile(db, a))?.careers[0]).toMatchObject({
      endDate: "2026-08-01",
      sourceNote: "新しいメモ",
    });

    // 別の内閣の人事 ID を、この内閣の URL で指定しても修正・削除できない
    expect(
      await updateAppointment(
        db,
        cabinetId,
        other.id,
        valid({ personId: b, sourceNote: "改ざん" }),
      ),
    ).toEqual({
      ok: false,
      reason: "notFound",
    });
    expect(await deleteAppointment(db, cabinetId, other.id)).toEqual({
      ok: false,
      reason: "notFound",
    });
    const untouched = (await getCabinetDetail(db, otherCabinetId))?.roster[0];
    expect(untouched).toMatchObject({ personName: "修正テスト乙", sourceNote: "" });
    // 存在しない人事 ID・存在しない内閣
    expect(await updateAppointment(db, cabinetId, 999999, valid({ personId: a }))).toEqual({
      ok: false,
      reason: "notFound",
    });
    expect(await deleteAppointment(db, cabinetId, 999999)).toEqual({
      ok: false,
      reason: "notFound",
    });
    expect(await updateAppointment(db, 999999, created.id, valid({ personId: a }))).toEqual({
      ok: false,
      reason: "notFound",
    });

    // 修正で他の在任者と重なるなら拒否（元の値は変わらない）
    const second = await createAppointment(
      db,
      cabinetId,
      valid({ personId: b, startDate: "2026-08-01" }),
    );
    if (!second.ok) throw new Error("追加できませんでした");
    expect(
      await updateAppointment(
        db,
        cabinetId,
        second.id,
        valid({ personId: b, startDate: "2026-07-31" }),
      ),
    ).toMatchObject({ reason: "conflict", fields: { postName: "postOverlap" } });
    expect((await getCabinetDetail(db, cabinetId))?.roster.map((r) => r.startDate)).toEqual([
      null,
      "2026-08-01",
    ]);

    // 削除すると名簿と経歴の両方から消える
    expect(await deleteAppointment(db, cabinetId, created.id)).toEqual({
      ok: true,
      id: created.id,
    });
    expect((await getCabinetDetail(db, cabinetId))?.roster.map((r) => r.personName)).toEqual([
      "修正テスト乙",
    ]);
    expect((await getPersonProfile(db, a))?.careers).toEqual([]);
  });

  it("名簿は標準の役職の順に並び、同じ役職は就任日の順に並ぶ。初期データの内閣の並びは変わらない", async () => {
    const cabinetId = await newCabinet("並び順テスト内閣", "2026-02-01", "2026-12-31");
    const people = [
      await newPerson("並び甲"),
      await newPerson("並び乙"),
      await newPerson("並び丙"),
      await newPerson("並び丁"),
    ];
    await createAppointment(db, cabinetId, valid({ postName: "外務大臣", personId: people[0]! }));
    await createAppointment(
      db,
      cabinetId,
      valid({ postName: "内閣総理大臣", personId: people[1]! }),
    );
    await createAppointment(
      db,
      cabinetId,
      valid({ postName: "内閣官房長官", personId: people[2]!, startDate: "2026-06-01" }),
    );
    await createAppointment(
      db,
      cabinetId,
      valid({ postName: "内閣官房長官", personId: people[3]!, endDate: "2026-06-01" }),
    );
    const roster = (await getCabinetDetail(db, cabinetId))?.roster ?? [];
    expect(roster.map((r) => `${r.postName}:${r.personName}`)).toEqual([
      "内閣総理大臣:並び乙",
      "内閣官房長官:並び丁",
      "内閣官房長官:並び丙",
      "外務大臣:並び甲",
    ]);
    // 首相が一覧に出る
    expect((await listCabinets(db)).find((c) => c.id === cabinetId)?.primeMinisterName).toBe(
      "並び乙",
    );

    // 初期データの内閣に人事を足しても、既存の行の相対的な順番は変わらない
    const [seeded] = await listCabinets(db);
    const before = (await getCabinetDetail(db, seeded!.id))?.roster.map((r) => r.id) ?? [];
    const extra = await newPerson("並び戊");
    const added = await createAppointment(
      db,
      seeded!.id,
      valid({ postName: "少子化対策担当大臣", personId: extra, startDate: seeded!.startDate }),
    );
    expect(added.ok).toBe(true);
    const after = (await getCabinetDetail(db, seeded!.id))?.roster.map((r) => r.id) ?? [];
    expect(after.filter((id) => before.includes(id))).toEqual(before);
  });

  it("経歴のある人物は、人事を消すまで削除できない（回帰）", async () => {
    const { deletePerson } = await import("./person-write.ts");
    const cabinetId = await newCabinet("人物削除テスト内閣", "2026-08-01");
    const personId = await newPerson("人物削除テスト");
    const created = await createAppointment(db, cabinetId, valid({ personId }));
    if (!created.ok) throw new Error("追加できませんでした");
    expect(await deletePerson(db, personId)).toEqual({ ok: false, reason: "hasCareers" });
    await deleteAppointment(db, cabinetId, created.id);
    expect(await deletePerson(db, personId)).toEqual({ ok: true, id: personId });
  });
});
