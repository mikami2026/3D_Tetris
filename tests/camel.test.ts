import { describe, expect, it } from 'vitest';
import { CamelView } from '../src/render/camelView';

describe('ゲームオーバーのラクダ', () => {
  it('ドット絵が壊れていない（行の長さ・使用文字）', () => {
    // CamelView のコンストラクタが行長と文字種を検証する。
    // ドット絵を編集して崩したときに、実行せずここで気づけるようにしておく。
    expect(() => new CamelView()).not.toThrow();
  });

  it('矩形が潰れていても描画で落ちない', () => {
    const camel = new CamelView();
    const renderer = {
      domElement: { clientHeight: 800 },
      setViewport: () => {},
      setScissor: () => {},
      setScissorTest: () => {},
      clearDepth: () => {},
      render: () => {
        throw new Error('潰れた矩形では描画してはいけない');
      },
    };
    expect(() =>
      camel.render(renderer as never, { x: 0, y: 0, width: 0, height: 0 }),
    ).not.toThrow();
  });
});
