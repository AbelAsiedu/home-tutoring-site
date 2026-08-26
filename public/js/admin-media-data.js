document.addEventListener('DOMContentLoaded', function () {
  if (window.location.pathname !== '/admin/media' || !document.getElementById('tutorsList')) return;
  Promise.all([
    fetch('/api/content/hero_banners_json').then(function (r) { return r.ok ? r.json() : null; }),
    fetch('/api/content/tutors_hero_banners_json').then(function (r) { return r.ok ? r.json() : null; }),
    fetch('/api/content/tutors_json').then(function (r) { return r.ok ? r.json() : null; })
  ]).then(function (rows) {
    function parse(row) {
      try {
        var value = row && row.value ? JSON.parse(row.value) : [];
        return Array.isArray(value) ? value : [];
      } catch (e) { return []; }
    }
    if (typeof homeBanners !== 'undefined') homeBanners = parse(rows[0]);
    if (typeof tutorBanners !== 'undefined') tutorBanners = parse(rows[1]);
    if (typeof tutors !== 'undefined') tutors = parse(rows[2]);
    if (typeof renderBanners === 'function') renderBanners();
    if (typeof renderTutors === 'function') renderTutors();
  }).catch(function (err) {
    console.error('Admin media manager data load failed:', err);
  });
});
