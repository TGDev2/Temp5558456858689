(function () {
  'use strict';

  const form = document.getElementById('contactForm');
  if (form) {
    const inputs = form.querySelectorAll('input, textarea');

    // Validation en temps réel sur chaque champ
    inputs.forEach(function(input) {
      input.addEventListener('input', function() {
        if (input.checkValidity()) {
          input.classList.remove('is-invalid');
          input.classList.add('is-valid');
        } else {
          input.classList.remove('is-valid');
          input.classList.add('is-invalid');
        }
      });
    });

    // Validation lors de la soumission du formulaire
    form.addEventListener('submit', function (event) {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      form.classList.add('was-validated');
    }, false);
  }
})();
