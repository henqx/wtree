# typed: false
# frozen_string_literal: true

class Wtree < Formula
  desc "Accelerate git worktree creation with hardlinked build artifacts"
  homepage "https://github.com/anthropics/wtree"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/anthropics/wtree/releases/download/v#{version}/wtree-darwin-arm64"
      sha256 "PLACEHOLDER_SHA256_DARWIN_ARM64"

      def install
        bin.install "wtree-darwin-arm64" => "wtree"
      end
    end
    on_intel do
      url "https://github.com/anthropics/wtree/releases/download/v#{version}/wtree-darwin-x64"
      sha256 "PLACEHOLDER_SHA256_DARWIN_X64"

      def install
        bin.install "wtree-darwin-x64" => "wtree"
      end
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/anthropics/wtree/releases/download/v#{version}/wtree-linux-arm64"
      sha256 "PLACEHOLDER_SHA256_LINUX_ARM64"

      def install
        bin.install "wtree-linux-arm64" => "wtree"
      end
    end
    on_intel do
      url "https://github.com/anthropics/wtree/releases/download/v#{version}/wtree-linux-x64"
      sha256 "PLACEHOLDER_SHA256_LINUX_X64"

      def install
        bin.install "wtree-linux-x64" => "wtree"
      end
    end
  end

  test do
    assert_match "wtree #{version}", shell_output("#{bin}/wtree --version")
  end
end
