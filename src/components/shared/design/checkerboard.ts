export const checkerboard = (cell: number) => ({
  backgroundImage: "repeating-conic-gradient(var(--line) 0% 25%, var(--surface) 0% 50%)",
  backgroundSize: `${cell}px ${cell}px`,
});
