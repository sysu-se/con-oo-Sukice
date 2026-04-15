# DESIGN.md - 领域对象的 Svelte 接入方案

## A. 领域对象如何被消费

本次项目采用了 **Store Adapter (方案 A)** 来将 `Sudoku` / `Game` 领域模型桥接到 Svelte 组件：

1. **View 层直接消费的是什么？**
   View 层并没有直接操作裸的 `Game` 实例。我们在 `stores/grid.js` 中创建了一个适配层（Adapter），内嵌了一个 `domainGameStore` 的 writable 对象。View 层消费的是由 Adapter 暴露出并派生出的伪装接口（如导出的 `userGrid` 对象，`$invalidCells` 和 `$canUndo` 的 derived stores）。
2. **View 层拿到的数据是什么？**
   通过 Svelte 原生的 `$store` 语法糖，View 拿到的是不可变的切片状态：
   - `grid`: 初始数独数据。
   - `userGrid`: 从 `$domainGame.getSudoku().getGrid()` 派生的当前玩家局面。
   - `invalidCells`: 从 `$domainGame.getSudoku().getInvalidCells()` 派生的数组。
   - `canUndo` / `canRedo`: 领域层历史栈的布尔值映射。
3. **用户操作如何进入领域对象？**
   在 Svelte 的 View 组件中（如 `Keyboard.svelte`），用户输入数字触发旧有的 `userGrid.set(pos, value)` 接口，而该接口在底层实现已经被我映射重定向到了 `domainGame.guess(pos.y, pos.x, value)`。该方法最终会调用原汁原味的领域对象 `Game.guess()` 方法。
4. **领域对象变化后，Svelte 为什么会更新？**
   在 Adapter 的修改方法中（如 `guess`，`undo`），我会调用 `domainGameStore.update(g => { g.guess(...); return g; })`。**将经过修改的对象实例 `g` 重新 return 出去是触发 Svelte 响应式机制的关键**。所有由它 `derived` 的 UI 数据流（`userGrid`, `invalidCells` 等）也会因此被动刷新。

## B. 响应式机制说明

1. **依赖了什么机制？**
   本次作业主要依赖了 `store` 机制（`writable` / `derived`）和订阅语法糖 `$store`。
2. **哪些数据是响应式暴露给 UI 的？**
   由于 `$domainGame` 更新就会触发连锁派生： `$userGrid`， `$invalidCells`， `$canUndo`， `$canRedo`，这四者被作为只读的响应式切片提供给了 UI 去渲染界面 `Board`、红色高亮以及控制按钮不可用状态。
3. **哪些状态留在领域对象内部？**
   具体的游戏规则校验算法逻辑、二维数组真实快照、以及历史记录 `undoStack` 和 `redoStack` 完全作为领域层的私有状态。UI 完全不知道“栈”的存在。
4. **如果直接 mutate 内部对象，会出现什么问题？**
   如果我们在组件里直接写 `$domainGame.guess(...)` 去突变（mutate）内部属性，Svelte 系统由于引用地址没有变化（还是同一个 Object/Array），无法捕捉到更新动作。这会导致“底层数据改变但页面数字不刷新”或“点击无效”的 Bug。因此我们必须走 `.update(g => return g)` 或使用重新赋值（`=`）来进行显式唤醒。

## C. 改进说明

1. **相比 HW1，改进了什么？**
   除了防御性深拷贝以修正浅拷贝栈污染问题外，我将“哪些格子填错了”的校验逻辑完全收纳到了领域模型内（`Sudoku.getInvalidCells()`），原先 Svelte Store 里那一大长串 `derived` 里的判断计算全被解耦替换掉。
2. **为什么 HW1 中的做法不足以支撑真实接入？**
   HW1 中 `Game` 是一个游离的纯对象。它无法通知 UI “我变了”。如果不增加一层封装转译机制（适配器），我们在 UI 中就需要写非常恶心的手动刷新逻辑（脏检查）。
3. **新设计的 trade-off？**
   - **优势**：UI 层甚至都没有感觉到变化（比如组件仍在使用 `userGrid` 的导出和 `$invalidCells`），最大程度降低了接入成本（Open-Closed 原则）。
   - **劣势**：每次触发动作都会导致上层创建一个完整克隆快照来放进撤销栈，并且 Svelte store 需要整体遍历刷新整个派生数据，内存占用与运算次数较多。在迁移 Svelte 5 (Runes 细粒度更新)时这些派生机制可以大幅削减。