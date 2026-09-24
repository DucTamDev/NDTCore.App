import { migrateTemplate, type TemplateMigrations } from '..';

describe('migrateTemplate', () => {
  it('không đổi document đã ở schema đích', () => {
    const document = { schemaVersion: 1, id: 'x' };

    expect(migrateTemplate(document)).toEqual({ ok: true, document });
  });

  it('chạy lần lượt từng migration theo thứ tự schema', () => {
    const calls: number[] = [];
    const migrations: TemplateMigrations = {
      1: (document) => {
        calls.push(1);
        return { ...document, schemaVersion: 2, renamed: document.old };
      },
      2: (document) => {
        calls.push(2);
        return { ...document, schemaVersion: 3, upper: String(document.renamed).toUpperCase() };
      },
    };

    const result = migrateTemplate({ schemaVersion: 1, old: 'abc' }, migrations, 3);

    expect(calls).toEqual([1, 2]);
    expect(result).toEqual({
      ok: true,
      document: { schemaVersion: 3, old: 'abc', renamed: 'abc', upper: 'ABC' },
    });
  });

  it('báo lỗi khi thiếu migration cho 1 bước', () => {
    const result = migrateTemplate({ schemaVersion: 1 }, {}, 2);

    expect(result).toEqual({ ok: false, issues: [{ path: 'schemaVersion', message: 'thiếu migration từ schema 1' }] });
  });

  it('báo lỗi khi migration quên cập nhật schemaVersion', () => {
    const migrations: TemplateMigrations = { 1: (document) => ({ ...document }) };

    const result = migrateTemplate({ schemaVersion: 1 }, migrations, 2);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].message).toContain('không cập nhật schemaVersion');
  });

  it('báo lỗi schemaVersion không phải số nguyên dương', () => {
    expect(migrateTemplate({ schemaVersion: '1' }).ok).toBe(false);
    expect(migrateTemplate({ schemaVersion: 0 }).ok).toBe(false);
  });
});
