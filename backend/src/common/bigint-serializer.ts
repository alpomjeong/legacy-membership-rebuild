// BigInt 를 JSON 직렬화 가능하게(문자열) 한다 — Prisma 의 BigInt id 를 응답에 담기 위함.
// main.ts 에서 import 하는 것만으로 부수효과로 적용된다.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function (this: bigint): string {
  return this.toString();
};

export {};
