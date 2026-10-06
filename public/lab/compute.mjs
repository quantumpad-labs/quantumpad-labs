// Deterministic inputs make measured results reproducible; these are workloads, not market data.
export function inputs(n) {
  if (![64, 128, 256, 512].includes(n))
    throw new Error("Unsupported matrix size.");
  const a = new Float32Array(n * n),
    b = new Float32Array(n * n);
  for (let i = 0; i < a.length; i++) {
    a[i] = ((i * 17 + 13) % 101) / 101;
    b[i] = ((i * 31 + 7) % 97) / 97;
  }
  return { a, b };
}
export function multiply(a, b, n) {
  const result = new Float32Array(n * n);
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++) {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += a[row * n + k] * b[k * n + col];
      result[row * n + col] = sum;
    }
  return result;
}
export function verify(a, b, result, n) {
  let maxError = 0;
  for (const index of [0, n - 1, Math.floor((n * n) / 2) + 3, n * n - 1]) {
    const row = Math.floor(index / n),
      col = index % n;
    let expected = 0;
    for (let k = 0; k < n; k++) expected += a[row * n + k] * b[k * n + col];
    maxError = Math.max(
      maxError,
      Math.abs(result[index] - expected) / Math.max(1, Math.abs(expected)),
    );
  }
  if (!Number.isFinite(maxError) || maxError > 0.001)
    throw new Error("Output verification failed.");
  return maxError;
}
