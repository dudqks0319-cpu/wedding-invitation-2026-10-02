import "react";

// style={{ "--inv-accent": "#fff" }} 처럼 CSS 변수를 쓸 수 있게 허용
declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
