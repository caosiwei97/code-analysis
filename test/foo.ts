import test, { name, age as Age } from 'mod'
import test2 from 'mod2'

const bar: Age = 1

function testFn(name) {
  const test = 1
}

testFn(name)

test.testFn()
