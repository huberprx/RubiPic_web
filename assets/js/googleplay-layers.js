(function () {
  var board = document.querySelector(".gp-feature--empty");
  if (!board) return;

  var layers = Array.prototype.slice.call(board.querySelectorAll(".gp-empty-layer"));
  var scratch = document.createElement("canvas").getContext("2d");

  function hitLayer(layer, clientX, clientY) {
    var rect = layer.getBoundingClientRect();
    if (clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom) {
      return false;
    }
    var img = layer.tagName === "IMG" ? layer : layer.querySelector("img");
    if (!img || !img.naturalWidth) return true;
    var x = ((clientX - rect.left) / rect.width) * img.naturalWidth;
    var y = ((clientY - rect.top) / rect.height) * img.naturalHeight;
    scratch.canvas.width = 1;
    scratch.canvas.height = 1;
    scratch.clearRect(0, 0, 1, 1);
    try {
      scratch.drawImage(img, x, y, 1, 1, 0, 0, 1, 1);
      return scratch.getImageData(0, 0, 1, 1).data[3] > 16;
    } catch (err) {
      return true;
    }
  }

  function pick(clientX, clientY) {
    for (var i = layers.length - 1; i >= 0; i -= 1) {
      if (hitLayer(layers[i], clientX, clientY)) return layers[i];
    }
    return null;
  }

  board.addEventListener(
    "pointerdown",
    function (event) {
      var layer = pick(event.clientX, event.clientY);
      if (!layer) return;
      event.stopPropagation();
      layer.focus();
    },
    true
  );

  document.querySelectorAll("[data-gp-layer]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = document.getElementById(btn.getAttribute("data-gp-layer"));
      if (target) target.focus();
    });
  });
})();
