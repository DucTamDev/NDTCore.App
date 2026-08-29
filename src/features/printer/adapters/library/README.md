# adapters/library/

Wrapper quanh **thư viện npm bên ngoài** dùng để giao tiếp với máy in.

Hiện **trống** — chưa có lib máy in nào được dùng trực tiếp ở tầng adapter.
`react-native-bluetooth-classic` / `react-native-tcp-socket` đang được
`transports/` gọi thẳng (chúng là transport byte generic, không riêng máy in).

Xem [`../native/`](../native/) cho bridge tới native module tự viết,
[`../vendor/`](../vendor/) cho SDK hãng.
