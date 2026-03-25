#!/bin/bash

# 当前输入
input=$(cat)

# 获取当前cc操作的path
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# 保存列表中文件不能被claude code编辑
# files=(".git/"  "settings.*.json" ".env" ".env/" "package-lock.json" "pnpm-lock.yaml" "yarn.lock")
config="$HOME/.claude/settings.json"
while IFS= read -r line; 
  do files+=("$line");
done < <(jq -r '.protectedFiles[]' "$config" 2>/dev/null)


for pattern in "${files[@]}"; do
  if [[ "$path" == *$pattern*  ]]; then
    echo "不可以修改文件: $path 匹配保护的文件,文件 '$pattern' 是被保护的." >&2
    exit 2
  fi  
done

