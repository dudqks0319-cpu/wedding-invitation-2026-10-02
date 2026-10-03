// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "WeddingNativeCore", platforms: [.macOS(.v14), .iOS(.v17)],
    products: [.library(name: "WeddingNativeCore", targets: ["WeddingNativeCore"])],
    targets: [.target(name: "WeddingNativeCore", path: "Core"), .testTarget(name: "WeddingNativeCoreTests", dependencies: ["WeddingNativeCore"], path: "Tests")])
