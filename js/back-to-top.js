// back-to-top.js - Affiche un bouton pour revenir en haut de la page

(function() {
    'use strict';
  
    const backToTopButton = document.getElementById('backToTop');
  
    window.addEventListener('scroll', function() {
      if (window.scrollY > 300) {
        backToTopButton.style.display = 'block';
      } else {
        backToTopButton.style.display = 'none';
      }
    });
  
    backToTopButton.addEventListener('click', function() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  })();
  