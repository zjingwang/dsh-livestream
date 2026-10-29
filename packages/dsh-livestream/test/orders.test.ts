import { describe, expect, it } from 'vitest';
import { OrderBook, orderTags } from '../src/core/orders';

describe('order book', () => {
  it('keeps orders in arrival order with the one being made first', () => {
    const book = new OrderBook();
    const a = book.add('卢哥love', '画我的头像', 1, '1')!;
    const b = book.add('屠勇士', '盖个光棱塔', 2)!;
    book.add('凑鸽子', '画我的头像', 3)!;
    book.mark(b.id, 'doing', 4);
    expect(book.open().map((o) => o.who)).toEqual(['屠勇士', '卢哥love', '凑鸽子']);
    book.mark(a.id, 'done', 5);
    expect(book.open().map((o) => o.id)).toEqual([2, 3]);
    expect(book.shown().map((o) => [o.id, o.state])).toEqual([[2, 'doing'], [3, 'queued'], [1, 'done']]);
  });

  it('tells the live line who is waiting, in order', () => {
    const book = new OrderBook();
    book.add('卢哥love', '画我的头像', 1)!;
    book.mark(book.add('屠勇士', '盖个光棱塔', 2)!.id, 'doing', 3);
    expect(book.summary()).toBe('点单队列（2 单没做完，按顺序）：#2 屠勇士「盖个光棱塔」（在做），#1 卢哥love「画我的头像」');
    expect(new OrderBook().summary()).toBe('');
  });

  it('comes back the same after a restart and keeps numbering', () => {
    const book = new OrderBook();
    book.add('a', 'x', 1)!;
    book.add('b', 'y', 2)!;
    const again = new OrderBook(JSON.parse(JSON.stringify(book)));
    expect(again.open().map((o) => o.who)).toEqual(['a', 'b']);
    expect(again.add('c', 'z', 3)!.id).toBe(3);
  });

  it('marks an order nobody has as a miss', () => {
    expect(new OrderBook().mark(9, 'done', 1)).toBe(false);
  });

  it('keeps only the last thirty closed orders', () => {
    const book = new OrderBook();
    // 边加边做完，别撞队列上限（同时 open 的始终只有 1 单）
    for (let i = 0; i < 40; i++) book.mark(book.add(`u${i}`, 'x', i)!.id, 'done', 100 + i);
    expect(book.toJSON().items).toHaveLength(30);
    expect(book.toJSON().items[0].who).toBe('u10');
  });
});

describe('通用点单队列（点歌/游戏一队列）', () => {
  it('记 kind=song 的单，默认 game；open/summary 可按 kind 过滤', () => {
    const book = new OrderBook();
    const s = book.add('晚风', '晴天', 1, '100', 'song')!;
    const g = book.add('卢哥love', '盖个光棱塔', 2, '1')!;
    expect(s.kind).toBe('song');
    expect(g.kind).toBe('game');
    expect(book.open('song').map((o) => o.id)).toEqual([s.id]);
    expect(book.open('game').map((o) => o.id)).toEqual([g.id]);
    expect(book.summary('song')).toContain('晚风');
    expect(book.summary('song')).not.toContain('光棱塔');
    // 舞台点单栏：两种都露
    expect(book.shown().map((o) => o.kind).sort()).toEqual(['game', 'song']);
  });

  it('队列上限：同时没做完的超过 20 单就拒收（返 null）', () => {
    const book = new OrderBook();
    for (let i = 0; i < 20; i++) expect(book.add(`u${i}`, 'x', i)).not.toBeNull();
    expect(book.add('u20', 'x', 20)).toBeNull();
    // 做完一单腾出位置就能再收
    book.mark(1, 'done', 21);
    expect(book.add('u21', 'x', 22)).not.toBeNull();
  });

  it('同人限点：同一个人同时最多 2 单（不同 kind 分开算）', () => {
    const book = new OrderBook();
    book.add('晚风', '晴天', 1, '100', 'song')!;
    book.add('晚风', '七里香', 2, '100', 'song')!;
    expect(book.add('晚风', '稻香', 3, '100', 'song')).toBeNull();
    expect(book.add('橘子', '稻香', 4, '200', 'song')).not.toBeNull(); // 别人不受影响
    expect(book.add('晚风', '盖个城堡', 5, '100', 'game')).not.toBeNull(); // 游戏单另算
  });

  it('顶单：顶过的排在前面；不存在的单顶不了', () => {
    const book = new OrderBook();
    const a = book.add('A', 'a', 1, '1', 'song')!;
    const b = book.add('B', 'b', 2, '2', 'song')!;
    expect(book.open('song').map((o) => o.id)).toEqual([a.id, b.id]);
    book.upvote(a.id);
    book.upvote(a.id);
    expect(book.open('song').map((o) => o.id)).toEqual([a.id, b.id]);
    expect(book.upvote(999)).toBe(false);
  });

  it('重启后 kind 和 priority 还在', () => {
    const book = new OrderBook();
    const a = book.add('A', 'a', 1, '1', 'song')!;
    book.upvote(a.id);
    const again = new OrderBook(JSON.parse(JSON.stringify(book)));
    expect(again.open('song')).toHaveLength(1);
    expect(again.open('song')[0].priority).toBe(1);
    expect(again.open('song')[0].kind).toBe('song');
  });
});

describe('order tags in what she says', () => {
  it('reads and removes the tags, leaving the words to speak', () => {
    expect(orderTags('[完成#3] 卢哥love，你的头像墙立好了！')).toEqual({ text: '卢哥love，你的头像墙立好了！', marks: [{ id: 3, state: 'done' }] });
    expect(orderTags('[开工# 4][不做#5] 光棱塔开盖，核弹就不画了')).toEqual({ text: '光棱塔开盖，核弹就不画了', marks: [{ id: 4, state: 'doing' }, { id: 5, state: 'dropped' }] });
  });
  it('leaves words without tags alone, mood tags included', () => {
    expect(orderTags('[laugh] 开盖！')).toEqual({ text: '[laugh] 开盖！', marks: [] });
  });
});
