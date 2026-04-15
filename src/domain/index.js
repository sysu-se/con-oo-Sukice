// 改进 1：加入独立的 Sudoku 领域模型，内聚 grid 数据和校验逻辑
export function createSudoku(inputGrid) {
  // 防御性拷贝 (Defensive Copy) 避免外部污染
  let grid = JSON.parse(JSON.stringify(inputGrid));

  return {
    getGrid: () => grid,

    guess: ({ row, col, value }) => {
      grid[row][col] = value;
    },

    clone: () => createSudoku(grid),

    toJSON: () => ({ grid: JSON.parse(JSON.stringify(grid)) }),

    toString: () => grid.map(row => row.join(', ')).join('\n'),

    // 改进 2：将 invalidCells 校验逻辑收归领域对象
    getInvalidCells: () => {
      const invalid = [];
      const addInvalid = (x, y) => {
        const xy = x + ',' + y;
        if (!invalid.includes(xy)) invalid.push(xy);
      };

      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          const value = grid[y][x];
          if (value === 0) continue;

          for (let i = 0; i < 9; i++) {
            if (i !== x && grid[y][i] === value) addInvalid(x, y);
            if (i !== y && grid[i][x] === value) addInvalid(x, y);
          }

          const startY = Math.floor(y / 3) * 3;
          const startX = Math.floor(x / 3) * 3;
          for (let r = startY; r < startY + 3; r++) {
            for (let c = startX; c < startX + 3; c++) {
              if (r !== y && c !== x && grid[r][c] === value) {
                addInvalid(x, y);
              }
            }
          }
        }
      }
      return invalid;
    }
  };
}

export function createSudokuFromJSON(json) {
  return createSudoku(json.grid);
}

// 改进 3：构建 Game 管理状态演进和撤销/重做
export function createGame({ sudoku }) {
  let current = sudoku;
  let undoStack = [];
  let redoStack = [];

  return {
    getSudoku: () => current,

    guess: (move) => {
      undoStack.push(current.clone());
      redoStack = []; // 有新动作则清空重做栈
      current.guess(move);
    },

    undo: () => {
      if (undoStack.length > 0) {
        redoStack.push(current.clone());
        current = undoStack.pop();
      }
    },

    redo: () => {
      if (redoStack.length > 0) {
        undoStack.push(current.clone());
        current = redoStack.pop();
      }
    },

    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,

    toJSON: () => ({
      current: current.toJSON(),
      undoStack: undoStack.map(s => s.toJSON()),
      redoStack: redoStack.map(s => s.toJSON())
    })
  };
}

export function createGameFromJSON(json) {
  return createGame({ sudoku: createSudokuFromJSON(json.current) });
}