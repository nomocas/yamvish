/*
console.log(y.expression.parse("user.name(12, 'hello') | date('dd-mm-yy').lower", 'expression'));
console.log(y.expression.parse("user.name(12, 'hello') | date.lower", 'expression'));
console.log(y.expression.parse("user.name | date('dd-mm-yy').lower"));
console.log(y.expression.parse("user.name(12, 'hello') | lower", 'expression'));
console.log(y.expression.parse("date('dd-mm-yy').lower", 'filters'));
console.log(y.html.parse('<div data-template="click(\'hello\')" class="bloupi"></div>'))
console.log(y.expression.parseTemplate("click ( '12', 14, true, p(2, 4, span( false).p())). div(12345)"));
*/

function range(size) {
  var output = [];
  for (var i = 0; i < size; ++i)
    output.push(Math.random());
  return output;
}


var mustache = require('mustache');

var y = require("../index");

var context = new y.Context({
  data: {
    title: 'Simpler is Better',
    users: ["John", "Bill"]
  },
  handlers: {
    hello: function(event) {
      console.log("click hellossss");
    }
  }
})

var text = '<ul data-template="text(\'{{ title }}\')" class="bloupi"><li>{{ $this }}</li></ul><p>hello</p>'
for (var i = 0; i < 12; ++i) // 1000 lignes (10 iterations because we double each time)
  text += text;

var text3 = '<ul data-template="text(\'{{ title }}\')" class="bloupi"><li>{{ $this }}</li></ul><p>hello</p>'
for (var i = 0; i < 12; ++i) // 1000 lignes (10 iterations because we double each time)
  text3 += text3;



var text2 = '<ul class="bloupi">{{#users}}<li>{{ . }}</li>{{/users}}</ul><p>{{ title }}</p>'
for (var i = 0; i < 12; ++i) // 1000 lignes (10 iterations because we double each time)
  text2 += text2;

//var template = y().div(y().p('{{ title }}'));
console.log("text.length = ", text.length);



var list = '<ul data-template="each(\'range\')" class="bloupi"><li>{{ $this }}</li></ul>'
var list2 = '<ul class="bloupi">{{#range}}<li>{{ . }}</li>{{/range}}</ul>'






var template = y.html.parse(list);


console.time("yamvish1");
for (var i = 0; i < 1; ++i) {
  context.data.range = range(1000);

  var elem = new y.Virtual({
    tagName: 'section'
  });
  template.call(elem, context);

  // context.set('users', ["John", "Bill"]);
  var r2 = elem.toString();

  // var template = y.html.parse('<ul data-template="each(\'users\').click(\'hello\')" class="bloupi"><li>{{ $this }}</li></ul><p>{{ title }}</p>', 'children');

  //var template = y.html.parse('<div data-template="h(1, \'youpiloup\').click(\'hello\').text(\'rooooo\').p(div(\'kssssss\'))" class="bloupi">{{ title }}</div><p>blupidouuu</p>')
  // var template = y.html.parse('<p/>');
}
console.timeEnd("yamvish1");

/*

context.data.range = range(1000);
console.time("yamvish2");
for (var i = 0; i < 1; ++i) {
  // console.log(
  var node = y.html2.toVirtual(list);
  node.bind(context);
  var r2 = node.toString()
    // );
    // console.log("template2 ", template2)
}
console.timeEnd("yamvish2");


*/



//_______________________________________________________



var tem = '<div hello="world" class="active">' + Math.random() + '{{#range}}<li>{{ . }}</li>{{/range}}</div><p>{{ title }} hello {{ title }}</p>'

mustache.parse(tem);

//_______________________________________________________
console.time("mustache");
for (var i = 0; i < 10; ++i) {
  var r = mustache.render(tem, context.data)
}
console.timeEnd("mustache");

document.body.innerHTML = "";

function x() {
  return new y.Template2();
};

var count = 1;

function range(size) {
  var output = [];
  for (var i = 0; i < size; ++i)
    output.push(Math.random());
  return output;
}

var context = new y.Context({
  data: {
    title: 'Simpler is Better',
    users: ["John", "Bill"],
    range: range(1000)
  },
  handlers: {
    hello: function(event) {
      console.log("click hellossss");
    }
  }
});

var templ = x()
  .div(
    '{{ title }}',
    x().h(1, 'hello')
    .click('hello')
    .ul(x().each('users',
      x().li('{{ $this }}')
    ))
  )
  .div(
    x()
    .attr('hello', 'world')
    .setClass('active')
    .ul(x().each('range',
      x().li('{{ $this }}')
    ))
    .div(
      '{{ title }}',
      x().h(1, 'hello')
      .click('hello')
    )
  )
  .p('{{ title }} hello {{ title }}');


console.time("yamvish Template.toString");
for (var i = 0; i < count; ++i) {
  templ.toString(context);
}
console.timeEnd("yamvish Template.toString");


console.time("yamvish Template.toString.innerHTML");
for (var i = 0; i < count; ++i) {
  document.body.innerHTML =
    templ.toString(context);
}
console.timeEnd("yamvish Template.toString.innerHTML");



document.body.innerHTML = "";

console.time("yamvish4 Template.toVirtual");
for (var i = 0; i < count; ++i) {
  var r4 = templ.toVirtual(context);
}
console.timeEnd("yamvish4 Template.toVirtual");


document.body.innerHTML = "";

console.time("yamvish5 virtual.toElment");
r4.childNodes.forEach(function(child) {
  document.body.appendChild(
    //console.log(
    child.toElement()
    //)
  );
})
console.timeEnd("yamvish5 virtual.toElment");

console.time("yamvish virtual.toString");
r4.childNodes.forEach(function(child) {
  child.toString()
})
console.timeEnd("yamvish virtual.toString");


document.body.innerHTML = "";


console.time("yamvish4 Template.toVirtual.toElement");
for (var i = 0; i < count; ++i) {
  templ.toVirtual(context)
    .childNodes.forEach(function(child) {
      document.body.appendChild(
        child.toElement()
      );
    });
}
console.timeEnd("yamvish4 Template.toVirtual.toElement");


document.body.innerHTML = '';

console.time("yamvish Template.toElement");
for (var i = 0; i < count; ++i)
  templ.toElement(context).mount(document.body)
console.timeEnd("yamvish Template.toElement");



console.time("yamvish Template.toVirtual.toString");
for (var i = 0; i < count; ++i) {
  templ.toVirtual(context)
    .childNodes.forEach(function(child) {
      child.toString()
    });
}
console.timeEnd("yamvish Template.toVirtual.toString");






context.set('title', 'erreerer')
  .set('range.11', 'reuuIIIIuu')
context.del('range.11')
