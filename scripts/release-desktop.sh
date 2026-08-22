#!/usr/bin/env bash
# ExcaliPPT 桌面版发布:构建 SPA + 双平台安装包 → 打 tag → 创建 GitHub Releases 草稿。
#
# 前置:
# - 仓库已 public(electron-updater 更新源零 token)
# - gh 写权限走 keyring token(env -u GITHUB_TOKEN 绕过权限不足的 PAT)
#
# 产物必须带 blockmap + latest*.yml —— electron-updater 自动更新依赖它们。
# 创建的是【草稿】Release:核对无误后手动发布,发布即触发 Win 端自动更新。

set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./desktop/package.json').version")"
TAG="v${VERSION}"
echo "==> 发布 ${TAG}"

yarn desktop:build
yarn --cwd ./desktop dist:mac
yarn --cwd ./desktop dist:win

if git rev-parse --verify --quiet "${TAG}" >/dev/null; then
  echo "==> tag 已存在,跳过: ${TAG}"
else
  git tag "${TAG}"
  echo "==> 已打本地 tag: ${TAG}(发布时需 push:git push origin ${TAG})"
fi

env -u GITHUB_TOKEN gh release create "${TAG}" \
  --title "ExcaliPPT ${TAG}" \
  --notes "桌面版 ${TAG}。Windows 安装后自动更新;macOS 请下载 dmg 覆盖安装(未签名,首启右键打开)。" \
  --draft \
  desktop/release/*.dmg \
  desktop/release/*.exe \
  desktop/release/*.blockmap \
  desktop/release/latest*.yml

echo "==> 草稿 Release 已创建:https://github.com/nephilimbin/ExcaliPPT/releases"
echo "    核对后手动发布,并 push tag:git push origin ${TAG}"
