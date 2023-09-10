function fibonacci(n: bigint): bigint {
    return n <= 1n ? 1n : fibonacci(n - 1n) + fibonacci(n - 2n);
}

export function main() {
    return console.log(10n);
}
