# Python sh 库 — 系统命令的函数化调用

> 把系统可执行程序动态映射为 Python 函数，替代 `subprocess`。
> 仅支持 Unix（macOS、Linux），不支持 Windows。

## 安装

```bash
pip install sh
```

## 基本用法

```python
from sh import git, curl, ls

print(git.status())
print(git.log("-5", "--oneline"))
print(ls("-la", "/tmp"))
```

## 管道

```python
from sh import cat, grep, wc

# cat /etc/passwd | grep root | wc -l
print(wc(grep(cat("/etc/passwd"), "root"), "-l"))
```

## 后台执行

```python
from sh import sleep

proc = sleep(10, _bg=True)
proc.wait()
```

## 实时迭代输出

```python
from sh import tail

for line in tail("-f", "/var/log/system.log", _iter=True):
    print(line, end="")
```

## 错误处理

```python
from sh import ls, ErrorReturnCode

try:
    ls("/不存在的路径")
except ErrorReturnCode as e:
    print(f"退出码: {e.exit_code}")
    print(f"stderr: {e.stderr.decode()}")
```

## 动态命令 & 子命令

```python
import sh

sh.ifconfig("en0")
sh.docker.ps("-a")  # 子命令用属性访问
```

## 原理

利用 Python `__getattr__` 魔术方法，`from sh import git` 时动态查找系统 PATH 中的可执行文件，返回可调用的 `Command` 对象。

## 对比 subprocess

|         | `subprocess`                        | `sh`           |
| ------- | ----------------------------------- | -------------- |
| 调用    | `subprocess.run(["git", "status"])` | `git.status()` |
| 管道    | 手动连接 stdin/stdout               | 函数嵌套       |
| 输出    | 需 `.stdout.decode()`               | 直接返回字符串 |
| Windows | 支持                                | 不支持         |

## 参考

- [GitHub - amoffat/sh](https://github.com/amoffat/sh)
- [PyPI](https://pypi.org/project/sh/)
