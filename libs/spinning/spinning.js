class SpinningPanel extends HTMLElement {
	constructor() {
		super();

		this.getStep = () => Number(this.dataset.step) || 0.005;
		this.getDirection = () => Number(this.dataset.direction) || 1;
		
		this.update = () => {
			const step = this.getStep();
			const direction = this.getDirection();
			const time = Date.now();
			const delta = time - (this.lastTime || 0);
			this.lastTime = time;

			function translatePanel(panel){
				let percent = Number(panel.style.translate.replace("%", ""));
				percent += delta * step * direction;
				if(Math.abs(percent) > 100)
					percent = 0;
				panel.style.translate = `${percent.toFixed(2)}%`;
			}

			translatePanel(this.panel1);
			translatePanel(this.panel2);
			this.panel2.style.left = this.getDirection() == 1 ? "-100%" : "100%";

			if(this.isConnected)
				requestAnimationFrame(this.update);
		};
	}

	connectedCallback() {
		if(!this.initialized){
			this.initialized = true;

			const children = Array.from(this.children);

			function createPanel(className){
				const panel = document.createElement("div");
				children.forEach((element) => {
					panel.innerHTML += element.outerHTML
				});
				panel.style.translate = "0%";
				panel.classList.add(className);
				return panel;
			}

			this.panel1 = createPanel("first");
			this.append(this.panel1);

			this.panel2 = createPanel("second");
			this.append(this.panel2);
			
			children.forEach((element) => this.removeChild(element));
		}
		requestAnimationFrame(this.update);
	}
}

customElements.define("spin-list", SpinningPanel);