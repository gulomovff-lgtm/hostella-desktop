import test from 'node:test';
import assert from 'node:assert/strict';

test('статьи расходов: объединение устройства и базы без потерь', async () => {
    // модуль тянет firebase — проверяем чистую функцию через динамический импорт исходника
    const src = (await import('node:fs')).readFileSync(new URL('../src/utils/expenseCats.js', import.meta.url), 'utf8');
    const body = src.slice(src.indexOf('export function mergeCats'), src.indexOf('const sameCats'));
    const mergeCats = new Function(body.replace('export function mergeCats', 'return function mergeCats'))();
    const r = mergeCats({ custom: ['Хоз', 'Такси'], icons: { 'Хоз': '🧴', 'Такси': '🚕' }, archived: ['Старое'] },
                        { custom: ['Хоз', 'Интернет-2'], icons: { 'Хоз': '🧽' }, archived: [] });
    assert.deepEqual(r.custom, ['Хоз', 'Интернет-2', 'Такси']);
    assert.equal(r.icons['Хоз'], '🧽', 'значок из базы главнее');
    assert.equal(r.icons['Такси'], '🚕');
    assert.deepEqual(r.archived, ['Старое']);
    assert.deepEqual(mergeCats({}, {}), { custom: [], icons: {}, archived: [] });
});
