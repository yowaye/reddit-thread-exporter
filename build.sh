#!/bin/bash
# 读取版本号
VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": "\(.*\)".*/\1/')
OUTFILE="dist/reddit-thread-exporter-v${VERSION}.zip"

mkdir -p dist

# 只打包扩展所需文件，排除所有配置/开发文件
zip -r "$OUTFILE" \
  manifest.json \
  content.js \
  popup.js \
  popup.html \
  styles.css \
  icons/ \
  _locales/ \
  --exclude "*.DS_Store"

echo "已打包：$OUTFILE"
