const RELEASES_API = "https://api.github.com/repos/MrSausainis/Aven-AI-Agent/releases/latest";
const REVIEWS_URL = "https://upiadmvxzphegivqszvp.supabase.co/rest/v1/reviews?select=rating,body,account_name&order=created_at.desc&limit=6";
const SUPABASE_ANON_KEY = "sb_publishable_iS9do7OPQuY-zEeAFfSrWQ_zA_IAObI";

fetch(RELEASES_API)
  .then((r) => r.ok ? r.json() : null)
  .then((data) => {
    if (data?.tag_name) document.getElementById("versionBadge").textContent = data.tag_name;
  })
  .catch(() => {});

fetch(REVIEWS_URL, { headers: { apikey: SUPABASE_ANON_KEY } })
  .then((r) => r.ok ? r.json() : [])
  .then((reviews) => {
    const grid = document.getElementById("reviewsGrid");
    if (!reviews?.length) {
      grid.innerHTML = '<p class="reviews-empty">No reviews yet. Signed-in users can leave one from the Account page.</p>';
      return;
    }
    grid.innerHTML = reviews.map((r) => `
      <article class="review-card">
        <div class="review-stars">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</div>
        <div class="review-body">${escapeHtml(r.body)}</div>
        <div class="review-author">${escapeHtml(r.account_name)}</div>
      </article>`).join("");
  })
  .catch(() => {
    document.getElementById("reviewsGrid").innerHTML = '<p class="reviews-empty">Reviews are unavailable right now.</p>';
  });

function escapeHtml(value){
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}
