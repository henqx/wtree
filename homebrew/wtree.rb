# typed: false
# frozen_string_literal: true

class Wtree < Formula
  desc "Accelerate git worktree creation with hardlinked build artifacts"
  homepage "https://github.com/henqx/wtree"
  version "0.3.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/henqx/wtree/releases/download/v#{version}/wtree-darwin-arm64"
      sha256 "e4f010a86b805be82635485c9b6e517ebb52527de00a96be879daeeb99115872"

      def install
        bin.install "wtree-darwin-arm64" => "wtree"
      end
    end
    on_intel do
      url "https://github.com/henqx/wtree/releases/download/v#{version}/wtree-darwin-x64"
      sha256 "d670f048c9a18f7ae9c54c4db5534fd20b1fe116432cb20d0bd598a3f5f78147"

      def install
        bin.install "wtree-darwin-x64" => "wtree"
      end
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/henqx/wtree/releases/download/v#{version}/wtree-linux-arm64"
      sha256 "b7e3b9708240c35531fb81e7e295f0e8b9f238a411456939b31da37055e89913"

      def install
        bin.install "wtree-linux-arm64" => "wtree"
      end
    end
    on_intel do
      url "https://github.com/henqx/wtree/releases/download/v#{version}/wtree-linux-x64"
      sha256 "a366e2ade8ea11875d4ac3ff87efc00ef95d9870aa0f538c740620f8bd5f655b"

      def install
        bin.install "wtree-linux-x64" => "wtree"
      end
    end
  end

  test do
    assert_match "wtree #{version}", shell_output("#{bin}/wtree --version")
  end
end
