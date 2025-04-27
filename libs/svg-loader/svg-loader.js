class SvgLoader extends HTMLElement {
	constructor() {
		super();
	}

	connectedCallback() {
		if(!this.initialized){
			this.initialized = true;

			async function load(that){
				const response = await fetch(that.dataset.path);
				if(response.ok)
					that.innerHTML = await response.text();
			}

			new Promise(() => load(this));
		}
	}
}

customElements.define("svg-loader", SvgLoader);