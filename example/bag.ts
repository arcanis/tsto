interface Foo {
    foo: string;
}

function getFoo(value: Foo) {
    return value.foo;
}

export function main() {
    console.log(getFoo({foo: "bar"}));
}
