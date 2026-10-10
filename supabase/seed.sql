insert into public.problems
  (id, slug, title, difficulty, category, description, input_format, output_format, starter_code, time_limit, memory_limit)
values
(
  '11111111-1111-4111-8111-111111111111',
  'two-sum',
  'Two Sum',
  'Easy',
  'Arrays & Hashing',
  'Given an array of integers and a target, print the indices of the two distinct values whose sum equals the target. Exactly one answer exists. Indices are zero-based.',
  'The first line contains the array integers separated by spaces. The last integer is the target.',
  'Print the two indices in ascending order, separated by a space.',
  $starter$
  {
    "javascript":"const fs = require('fs');\nconst values = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconst target = values.pop();\nconst seen = new Map();\nfor (let i = 0; i < values.length; i++) {\n  const other = target - values[i];\n  if (seen.has(other)) {\n    console.log(seen.get(other), i);\n    break;\n  }\n  seen.set(values[i], i);\n}",
    "python":"values = list(map(int, input().split()))\ntarget = values.pop()\nseen = {}\nfor i, value in enumerate(values):\n    other = target - value\n    if other in seen:\n        print(seen[other], i)\n        break\n    seen[value] = i",
    "java":"import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        List<Integer> values = new ArrayList<>();\n        while (scanner.hasNextInt()) values.add(scanner.nextInt());\n        int target = values.remove(values.size() - 1);\n        Map<Integer, Integer> seen = new HashMap<>();\n        for (int i = 0; i < values.size(); i++) {\n            int value = values.get(i);\n            if (seen.containsKey(target - value)) {\n                System.out.println(seen.get(target - value) + \" \" + i);\n                break;\n            }\n            seen.put(value, i);\n        }\n    }\n}",
    "cpp":"#include <iostream>\n#include <vector>\n#include <unordered_map>\nusing namespace std;\nint main() {\n    vector<int> values;\n    int value;\n    while (cin >> value) values.push_back(value);\n    int target = values.back();\n    values.pop_back();\n    unordered_map<int, int> seen;\n    for (int i = 0; i < static_cast<int>(values.size()); ++i) {\n        int other = target - values[i];\n        if (seen.count(other)) { cout << seen[other] << \" \" << i << endl; break; }\n        seen[values[i]] = i;\n    }\n}"
  }
  $starter$::jsonb,
  2000,
  128
),
(
  '22222222-2222-4222-8222-222222222222',
  'valid-palindrome',
  'Valid Palindrome',
  'Easy',
  'Strings',
  'Given a line of text, determine whether it is a palindrome after converting letters to lowercase and removing every character that is not an English letter or digit. Print true or false.',
  'A single line of text.',
  'Print true if the normalized text is a palindrome; otherwise print false.',
  $starter$
  {
    "javascript":"const fs = require('fs');\nconst text = fs.readFileSync(0, 'utf8').replace(/\\r?\\n$/, '').toLowerCase().replace(/[^a-z0-9]/g, '');\nconsole.log(text === [...text].reverse().join('') ? 'true' : 'false');",
    "python":"import re\ntext = input().lower()\ntext = re.sub(r'[^a-z0-9]', '', text)\nprint('true' if text == text[::-1] else 'false')",
    "java":"import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        String text = scanner.hasNextLine() ? scanner.nextLine().toLowerCase().replaceAll(\"[^a-z0-9]\", \"\") : \"\";\n        System.out.println(text.equals(new StringBuilder(text).reverse().toString()) ? \"true\" : \"false\");\n    }\n}",
    "cpp":"#include <iostream>\n#include <string>\n#include <cctype>\n#include <algorithm>\nusing namespace std;\nint main() {\n    string text, clean;\n    getline(cin, text);\n    for (unsigned char c : text) if (isalnum(c)) clean += static_cast<char>(tolower(c));\n    string reversed = clean;\n    reverse(reversed.begin(), reversed.end());\n    cout << (clean == reversed ? \"true\" : \"false\") << endl;\n}"
  }
  $starter$::jsonb,
  2000,
  128
),
(
  '33333333-3333-4333-8333-333333333333',
  'reverse-string',
  'Reverse String',
  'Easy',
  'Strings',
  'Read a line of text and print its characters in reverse order. The input may contain spaces.',
  'A single line of text.',
  'Print the input characters in reverse order.',
  $starter$
  {
    "javascript":"const fs = require('fs');\nconst text = fs.readFileSync(0, 'utf8').replace(/\\r?\\n$/, '');\nconsole.log([...text].reverse().join(''));",
    "python":"text = input()\nprint(text[::-1])",
    "java":"import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        String text = scanner.hasNextLine() ? scanner.nextLine() : \"\";\n        System.out.println(new StringBuilder(text).reverse());\n    }\n}",
    "cpp":"#include <iostream>\n#include <string>\n#include <algorithm>\nusing namespace std;\nint main() {\n    string text;\n    getline(cin, text);\n    reverse(text.begin(), text.end());\n    cout << text << endl;\n}"
  }
  $starter$::jsonb,
  2000,
  128
)
on conflict (slug) do update set
  title = excluded.title,
  difficulty = excluded.difficulty,
  category = excluded.category,
  description = excluded.description,
  input_format = excluded.input_format,
  output_format = excluded.output_format,
  starter_code = excluded.starter_code,
  time_limit = excluded.time_limit,
  memory_limit = excluded.memory_limit;

insert into public.test_cases (problem_id, input, expected_output, is_sample, position)
values
  ('11111111-1111-4111-8111-111111111111', '2 7 11 15 9', '1 2', true, 0),
  ('11111111-1111-4111-8111-111111111111', '3 2 4 6', '1 2', true, 1),
  ('11111111-1111-4111-8111-111111111111', '3 3 6', '0 1', false, 2),
  ('11111111-1111-4111-8111-111111111111', '-4 8 2 4', '0 1', false, 3),
  ('22222222-2222-4222-8222-222222222222', 'A man, a plan, a canal: Panama', 'true', true, 0),
  ('22222222-2222-4222-8222-222222222222', 'race a car', 'false', true, 1),
  ('22222222-2222-4222-8222-222222222222', ' ', 'true', false, 2),
  ('22222222-2222-4222-8222-222222222222', '0P', 'false', false, 3),
  ('33333333-3333-4333-8333-333333333333', 'hello', 'olleh', true, 0),
  ('33333333-3333-4333-8333-333333333333', 'code arena', 'anera edoc', true, 1),
  ('33333333-3333-4333-8333-333333333333', 'a', 'a', false, 2),
  ('33333333-3333-4333-8333-333333333333', 'ab', 'ba', false, 3)
on conflict (problem_id, position) do update set
  input = excluded.input,
  expected_output = excluded.expected_output,
  is_sample = excluded.is_sample;
