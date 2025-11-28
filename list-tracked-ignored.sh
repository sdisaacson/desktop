#!/bin/bash
# Description: Lists all tracked files in the repository that are also ignored by .gitignore rules.

# The git ls-files command lists all tracked files.
# The while read loop processes each file name one by one.
# git check-ignore -q "$file" checks if the file is ignored.
# The -q (quiet) option suppresses output, and it returns an exit status of 0 if the file is ignored.
# If the exit status is 0 (i.e., the file is ignored), the file name is printed.
git ls-files | while read file; do
      if git check-ignore -q "$file"; then
        echo "$file"
      fi
    done
