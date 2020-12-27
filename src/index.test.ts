import hello from "."

describe('hello', () => {
  it('returns string `world`', () => {
    expect(hello()).toEqual('world')
  })

})