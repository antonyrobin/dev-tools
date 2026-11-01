// Languages offered by the Code Compiler page.
// engine 'browser' runs JavaScript in a Web Worker, 'html' renders a sandboxed preview,
// and 'remote' compiles and runs on the free Wandbox service (wandbox.org); `wandbox` is
// the language name in its compiler list and `prefer` picks the default version.
// Templates avoid "${" so they can stay raw strings.

const t = String.raw;

export const COMPILER_LANGUAGES = [
  {
    id: 'javascript', label: 'JavaScript', engine: 'browser', wandbox: 'JavaScript', ext: ['js', 'mjs', 'cjs'],
    template: t`// Runs locally in your browser (choose a Node.js version to run on a server)
const nums = [1, 2, 3];
console.log("Hello, World!");
nums.forEach((n) => console.log(n + " squared is " + n * n));
console.table(nums.map((n) => ({ n, square: n * n })));
`,
  },
  {
    id: 'html', label: 'HTML / CSS / JS', engine: 'html', ext: ['html', 'htm'],
    template: t`<!doctype html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; padding: 1.5rem; }
    button { padding: 0.5rem 1rem; font-size: 1rem; }
  </style>
</head>
<body>
  <h1>Hello, World!</h1>
  <button id="btn">Clicked 0 times</button>
  <script>
    let count = 0;
    document.getElementById('btn').addEventListener('click', (e) => {
      count++;
      e.target.textContent = 'Clicked ' + count + ' times';
      console.log('click', count);
    });
  </script>
</body>
</html>
`,
  },
  {
    id: 'typescript', label: 'TypeScript', engine: 'remote', wandbox: 'TypeScript', ext: ['ts'],
    template: t`interface User {
  name: string;
  age: number;
}

const users: User[] = [{ name: "Ada", age: 36 }, { name: "Linus", age: 28 }];
const greet = (u: User): string => "Hello, " + u.name + " (" + u.age + ")";

console.log("Hello, World!");
users.forEach((u) => console.log(greet(u)));
`,
  },
  {
    id: 'python', label: 'Python', engine: 'remote', wandbox: 'Python', prefer: /^cpython-3/, ext: ['py'],
    template: t`import sys

print("Hello, World!")
for i in range(1, 4):
    print(f"{i} squared is {i * i}")

# Read from the Input (stdin) tab
for line in sys.stdin:
    print("You typed:", line.rstrip())
`,
  },
  {
    id: 'java', label: 'Java', engine: 'remote', wandbox: 'Java', ext: ['java'],
    template: t`import java.util.*;

class Prog {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        for (int i = 1; i <= 3; i++) {
            System.out.println(i + " squared is " + (i * i));
        }
    }
}
`,
  },
  {
    id: 'c', label: 'C', engine: 'remote', wandbox: 'C', ext: ['c', 'h'],
    template: t`#include <stdio.h>

int main(void) {
    printf("Hello, World!\n");
    for (int i = 1; i <= 3; i++) {
        printf("%d squared is %d\n", i, i * i);
    }
    return 0;
}
`,
  },
  {
    id: 'cpp', label: 'C++', engine: 'remote', wandbox: 'C++', ext: ['cpp', 'cc', 'cxx', 'hpp'],
    template: t`#include <iostream>
#include <vector>

int main() {
    std::vector<int> nums{1, 2, 3};
    std::cout << "Hello, World!\n";
    for (int n : nums) {
        std::cout << n << " squared is " << n * n << '\n';
    }
    return 0;
}
`,
  },
  {
    id: 'csharp', label: 'C#', engine: 'remote', wandbox: 'C#', ext: ['cs'],
    template: t`using System;

class Program
{
    static void Main()
    {
        Console.WriteLine("Hello, World!");
        for (int i = 1; i <= 3; i++)
        {
            Console.WriteLine(i + " squared is " + (i * i));
        }
    }
}
`,
  },
  {
    id: 'go', label: 'Go', engine: 'remote', wandbox: 'Go', ext: ['go'],
    template: t`package main

import "fmt"

func main() {
	fmt.Println("Hello, World!")
	for i := 1; i <= 3; i++ {
		fmt.Printf("%d squared is %d\n", i, i*i)
	}
}
`,
  },
  {
    id: 'rust', label: 'Rust', engine: 'remote', wandbox: 'Rust', ext: ['rs'],
    template: t`fn main() {
    println!("Hello, World!");
    for i in 1..=3 {
        println!("{} squared is {}", i, i * i);
    }
}
`,
  },
  {
    id: 'php', label: 'PHP', engine: 'remote', wandbox: 'PHP', ext: ['php'],
    template: t`<?php
echo "Hello, World!\n";
for ($i = 1; $i <= 3; $i++) {
    echo "$i squared is " . ($i * $i) . "\n";
}
`,
  },
  {
    id: 'ruby', label: 'Ruby', engine: 'remote', wandbox: 'Ruby', ext: ['rb'],
    template: t`puts "Hello, World!"
(1..3).each { |i| puts "#{i} squared is #{i * i}" }
`,
  },
  {
    id: 'swift', label: 'Swift', engine: 'remote', wandbox: 'Swift', ext: ['swift'],
    template: t`print("Hello, World!")
for i in 1...3 {
    print("\(i) squared is \(i * i)")
}
`,
  },
  {
    id: 'scala', label: 'Scala', engine: 'remote', wandbox: 'Scala', ext: ['scala'],
    template: t`object Main {
  def main(args: Array[String]): Unit = {
    println("Hello, World!")
    for (i <- 1 to 3) println(s"$i squared is " + (i * i))
  }
}
`,
  },
  {
    id: 'haskell', label: 'Haskell', engine: 'remote', wandbox: 'Haskell', ext: ['hs'],
    template: t`main :: IO ()
main = do
  putStrLn "Hello, World!"
  mapM_ (\i -> putStrLn (show i ++ " squared is " ++ show (i * i))) [1 .. 3 :: Int]
`,
  },
  {
    id: 'bash', label: 'Bash', engine: 'remote', wandbox: 'Bash script', ext: ['sh', 'bash'],
    template: t`#!/bin/bash
echo "Hello, World!"
for i in 1 2 3; do
  echo "$i squared is $((i * i))"
done
`,
  },
  {
    id: 'sql', label: 'SQL (SQLite)', engine: 'remote', wandbox: 'SQL', ext: ['sql'],
    template: t`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);
INSERT INTO users (name, age) VALUES ('Ada', 36), ('Linus', 28), ('Grace', 45);

.headers on
.mode column
SELECT id, name, age FROM users WHERE age > 30 ORDER BY age DESC;
`,
  },
  {
    id: 'lua', label: 'Lua', engine: 'remote', wandbox: 'Lua', ext: ['lua'],
    template: t`print("Hello, World!")
for i = 1, 3 do
  print(i .. " squared is " .. i * i)
end
`,
  },
  {
    id: 'perl', label: 'Perl', engine: 'remote', wandbox: 'Perl', ext: ['pl', 'pm'],
    template: t`use strict;
use warnings;

print "Hello, World!\n";
for my $i (1 .. 3) {
    print "$i squared is ", $i * $i, "\n";
}
`,
  },
  {
    id: 'r', label: 'R', engine: 'remote', wandbox: 'R', ext: ['r'],
    template: t`cat("Hello, World!\n")
for (i in 1:3) cat(i, "squared is", i * i, "\n")
df <- data.frame(n = 1:3, square = (1:3)^2)
print(df)
`,
  },
  {
    id: 'julia', label: 'Julia', engine: 'remote', wandbox: 'Julia', ext: ['jl'],
    template: t`println("Hello, World!")
for i in 1:3
    println(i, " squared is ", i * i)
end
`,
  },
  {
    id: 'elixir', label: 'Elixir', engine: 'remote', wandbox: 'Elixir', ext: ['ex', 'exs'],
    template: t`IO.puts("Hello, World!")
Enum.each(1..3, fn i -> IO.puts("#{i} squared is #{i * i}") end)
`,
  },
  {
    id: 'ocaml', label: 'OCaml', engine: 'remote', wandbox: 'OCaml', ext: ['ml'],
    template: t`let () =
  print_endline "Hello, World!";
  for i = 1 to 3 do
    Printf.printf "%d squared is %d\n" i (i * i)
  done
`,
  },
  {
    id: 'd', label: 'D', engine: 'remote', wandbox: 'D', ext: ['d'],
    template: t`import std.stdio;

void main() {
    writeln("Hello, World!");
    foreach (i; 1 .. 4) writefln("%d squared is %d", i, i * i);
}
`,
  },
  {
    id: 'nim', label: 'Nim', engine: 'remote', wandbox: 'Nim', ext: ['nim'],
    template: t`echo "Hello, World!"
for i in 1..3:
  echo i, " squared is ", i * i
`,
  },
  {
    id: 'zig', label: 'Zig', engine: 'remote', wandbox: 'Zig', ext: ['zig'],
    template: t`const std = @import("std");

pub fn main() void {
    std.debug.print("Hello, World!\n", .{});
    var i: u32 = 1;
    while (i <= 3) : (i += 1) {
        std.debug.print("{d} squared is {d}\n", .{ i, i * i });
    }
}
`,
  },
  {
    id: 'crystal', label: 'Crystal', engine: 'remote', wandbox: 'Crystal', ext: ['cr'],
    template: t`puts "Hello, World!"
(1..3).each { |i| puts "#{i} squared is #{i * i}" }
`,
  },
  {
    id: 'pascal', label: 'Pascal', engine: 'remote', wandbox: 'Pascal', ext: ['pas'],
    template: t`program Hello;
var
  i: integer;
begin
  writeln('Hello, World!');
  for i := 1 to 3 do
    writeln(i, ' squared is ', i * i);
end.
`,
  },
  {
    id: 'groovy', label: 'Groovy', engine: 'remote', wandbox: 'Groovy', ext: ['groovy'],
    template: t`println "Hello, World!"
(1..3).each { i -> println "$i squared is " + (i * i) }
`,
  },
  {
    id: 'lisp', label: 'Common Lisp', engine: 'remote', wandbox: 'Lisp', ext: ['lisp', 'cl'],
    template: t`(format t "Hello, World!~%")
(loop for i from 1 to 3
      do (format t "~a squared is ~a~%" i (* i i)))
`,
  },
];

export const LANGUAGE_BY_EXT = Object.fromEntries(
  COMPILER_LANGUAGES.flatMap((l) => l.ext.map((e) => [e, l.id]))
);
