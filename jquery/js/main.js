$(document).ready(function() {
  $('#fetchBtn').click(function() {
    $.get('http://localhost:4000/api/v1/hello', function(data) {
      $('#result').text(data.message);
    }).fail(function() {
      $('#result').text('Failed to fetch data.');
    });
  });
});
