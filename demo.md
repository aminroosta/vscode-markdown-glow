# h1 Heading
## h2 Heading
### h3 Heading

___
---
***

- **This is bold text**
- __This is bold text__
- *This is italic text*
- _This is italic text_
- ~~Strikethrough~~

> Blockquotes can also be nested...
>> ...by using additional greater-than signs right next to each other...
> > > ...or with spaces between arrows.

+ Create a list by starting a line with `+`, `-`, or `*`
+ Sub-lists are made by indenting 2 spaces:
  - Marker character change forces new list start:
    * Ac tristique libero volutpat at
      + Facilisis in pretium nisl aliquet
    - Nulla volutpat aliquam velit

``` ts
var foo = function (bar: number) {
  return bar++;
};

console.log(foo(5));
```

* Links
  * [link text](http://dev.nodeca.com)
  * [link with title](http://nodeca.github.io/pica/demo/ "title text!")
* Images
  * ![Minion](https://octodex.github.com/images/minion.png)
  * ![Stormtroopocat](https://octodex.github.com/images/stormtroopocat.jpg "The Stormtroopocat")
* Emojies
  *  Classic markup: :wink: :cry: :laughing: :yum:
* Footnotes
  * Footnote 1 link[^first].
  * Footnote 2 link[^second].

[^first]: Footnote **can have markup**
[^second]: Footnote text.


| Option | Description | optional |
| :------:| :-----------:| :---: |
| data  sss **bold**! | path to data files . | No |
| engine | engine to be used for processing templates. | No |
| ext    | extension for dest files.| Yes |
