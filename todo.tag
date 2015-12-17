

<flag:bloupi some="true" title path >
	<div>
		<script>

			if(some)
				some = false;

			this
			.cl('active', '{{ page === $opts.title }}')
			.cl('aClass', '{{ $get($opts.path) }}') // dereference opts.pat to get associated var in context
			.click(function(e){

			});
		</script>
		<h1>{{ $opts.title }}</h1>
		<span><yield/></span>
		<style type="text/css" scoped>
			:scope {

			}
		</style>
	</div>
</flag:bloupi>

<script>


	y.addToApi('flag', 'bloupi', { some:true, title:undefined, path:undefined }, function(some, title, path, templ){
		return this.div(
			y().use(function(some, title, path, templ){

				if(some)
					some = false;

				this
				.cl('active', '{{ page === $opts.title }}')
				.cl('aClass', '{{ '+ path +' }}')
				.click(function(e){

				});
			}, some, title, path, templ)
			.h(1, '{{ $opts.title }}')
			.span( y().yield() )
			.style('...')
		);
	});


	y.addToApi = function (api, name, map, handler){

		var env = y.env();
		env.api[api] = env.api[api] || {};

		env.api[api][name] = function(){
			var args = Array.prototype.slice.call(arguments);
			var opts = {}, count = 0;
			for(var i in map)
			{
				args[count] = opts[i] = args[count] || map[i];
				count++;
			}
			this.pushOpts(opts)
			handler.apply(this, args);
			this.popOpts();
			return this;
		}
	};
</script>


<flag:bloupi title="My Title" path="foo"> hello world </flag:bloupi>


<!--

	le vrai probleme : correspondance entre arguments et attributes


	a la compilation : 

		.pushOpts({ ... }) // push dans la pile d'opts du context courrant
		
		.. tout le reste

		.popOpts() // pop dans la pile d'opts du context courrant


	interpolable instanciation :
		 lorsque boucle sur dep : check si dep[0] == $opts ==> skip bind and store value in instance

 -->