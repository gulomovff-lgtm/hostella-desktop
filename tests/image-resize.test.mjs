import test from 'node:test';
import assert from 'node:assert/strict';
import { fitSize } from '../src/utils/imageResize.js';

test('fitSize: длинная сторона не больше 512, пропорции сохраняются, маленькие не растягиваются', () => {
    assert.deepEqual(fitSize(4000, 3000), { width: 512, height: 384 });
    assert.deepEqual(fitSize(1080, 1920), { width: 288, height: 512 });
    assert.deepEqual(fitSize(300, 200), { width: 300, height: 200 });
    assert.deepEqual(fitSize(0, 100), { width: 0, height: 0 });
});
