function initRouting(){
	new Promise(() => loadPage(window.location.pathname));

	document.onclick = function (e) {
		e = e || window.event;
		var element = e.target || e.srcElement;

		if (element.tagName == 'A' && element.href.startsWith(window.location.origin)) {
			loadPage(element.href.replace(window.location.origin, ""));
			return false;
		}
	};
}

async function loadPage(path){
	if(window.location.pathname != path)
		window.history.pushState(path, "", path);
	
	const filePath = path == "/" ? "/index" : path;

	const response = await fetch(`./pages${filePath}.html`);
	if(!response.ok){
		loadPage("/");
		return;
	}

	// Unmark all selected elements
	document.querySelectorAll("*[data-select-on-route]").forEach((element) => {
		element.classList.remove("selected");
	});

	// Mark selected elements
	document.querySelectorAll(`*[data-select-on-route="${path}"]`).forEach((element) => {
		element.classList.add("selected");
	});

	const container = document.getElementsByTagName("container")[0];
	container.innerHTML = await response.text();
	window.scrollTo(0, 0);
}