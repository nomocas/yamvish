

<flag:bloupi some="true" >
	<script>
		this.load('bar', 'json::bloupi');
	</script>
	<div>
		<script>
			this
			.set('opts.some', false)
			.cl('active', '{{ page === opts.title }}')
			.cl('aClass', '{{ opts.path | exist() }}') // dereference opts.pat to get associated var in context
			.click(function(e){

			});
		</script>
		<h1>{{ opts.title }}</h1>
		<span><yield/></span>
		<style type="text/sass" scoped>
			:scope {

			}
		</style>
	</div>
</flag:bloupi>

<script>
	y.addCustomTag('flag', 'bloupi', { some:true }, 
		y().load('bar', 'json::bloupi')
		.route('/flu')
		.div(
			y().use(function(){
				return this
				.set('opts.some', false)
				.cl('active', '{{ page === opts.title }}')
				.cl('aClass', '{{ opts.path | exist() }}') // dereference opts.pat to get associated var in context
				.click(function(e){

				});
			}, true)
			.h(1, '{{ opts.title }}')
			.span( y().__yield() )
			.style({ type:'sass', scoped:true }, '...')
		)
	);
</script>


<flag:bloupi title="My Title" path="foo"> hello world </flag:bloupi>

<script>
	y().use('flag:bloupi', { title:'My Title', path:'foo' }, y().text('hello world'));
</script>


<uikit:flockity items="{{ schloupi.foo }}" autoPlay="5000" />

<script>
	y.addToApi('uikit','flickity', function(opts){

	});
</script>

<!--

 -->