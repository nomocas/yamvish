# spec

- clean and small.
- data-binding
- incredibly fast both sides. 
	multiple output engines (pure dom, pure string, two-pass, ...)
	no virtual DOM.
	Only functions.

- real isomorphism
	dom and single app in mind.
	nothing to rewrite.
	absolute control on plateform/target related output.
	simple as-you-want browser-side.
	simple expressjs middleware server-side.
	seemless async management.

- maximal modularity and reusability
- easy to learn. clean syntax. only the needed. no bullshit.
- unobstrusive as possible. happy mix with anything else.
- lazzy construction, flow control and organic style.
- free code architecture.
	no particular structure or sequence. 
	no App or View classes.
	no inheritance needed.

	naturally clean encapsulation
	well splitted or gathered code/files
	no parent to child bind
	useful agora object for modules communications
	...

- really fast parsing
- pure js or transpiler agnostic
- easy to contribute. easyly extendable. easy plugin dev.
- complete ecosystem for really fast dev
	- c3po bridge and data loading
	- collection filtering with RQL
	- data validation with aright
	- date formatting
	- organic inline router
	- easy model management
	- dom node transitions
	- translation tools
	- uikit

- IE10+ with Promise polyfill.

# triptique

	

	Context (observable data holder)

	Template

	Nodes and Container (mountable nodes group)



# Template

Composition
	use

Simple Conditional flow
	if
	client
	server

Lazzy flow
	suspendUntil

each
with
newContext



output engines
	dom
	string
	firstPass
	secondPass

context
	set
	dependent
	...

tags
	all html5
	br
	nbsp
	a
	img
	h

	Form
		input
		textarea
		select

attributes
	id
	attr
	prop
	setClass/cl
	contentEditable
	val
	css
	visible
	disabled

content
	text
	raw
	html

Agora
	toAgora
	onAgora
	offAgora
	clickToAgora

Events
	on
	off
	once

	+ all dom events


container related
	container
	mountIf
	switch
	mountHere
	lateMount
	addWitness

views related
	view
	agoraView


# Context

get
set
setAsync
push
pushAsync
del
toggle
toggleInArray
call
dependent
subscribe
unsubscribe
notify
clone
destroy

toAgora
onAgora
offAgora


.data

## Async
	
stabilised
waiting
delay
on
off
once


## env
clone


# Container

mount
append
addWitness
destroy


# Agora




# Interpolable

output
subscribeTo
destroy

# Filter



# API

y.toAPI


# Parsers


y.html.parse

	html5 to template

	...


