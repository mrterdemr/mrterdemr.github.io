const githubUser = "mrterdemr";
const excludedRepoNames = new Set(["mrterdemr.github.io"]);

const repoTypeOverrides = {
  hash2tie: "CLI Tool",
  "eXit-game": "Game",
};

let staticProjects = [];
let projects = [];
let commits = [];

const colors = ["#3f78b5", "#b94747", "#8ab64f", "#705498", "#4da0b8", "#d5792b", "#9fb8d4"];
const filterRoot = document.querySelector("#filters");
const presentSelect = document.querySelector("#presentSelect");
const categorySelect = document.querySelector("#categorySelect");
const statusSelect = document.querySelector("#statusSelect");
const searchInput = document.querySelector("#searchInput");
const matchCount = document.querySelector("#matchCount");
const projectTable = document.querySelector("#projectTable");
const commitCount = document.querySelector("#commitCount");
const commitTable = document.querySelector("#commitTable");
const menuButton = document.querySelector(".menu-button");
const appMenu = document.querySelector("#appMenu");
const menuSearch = document.querySelector("#menuSearch");
const accountToggle = document.querySelector(".account-toggle");
const accountMenu = document.querySelector("#accountMenu");
const menuUtcTime = document.querySelector("#menuUtcTime");

let activeCategory = "All";

function projectUrl(repo) {
  return `https://github.com/${githubUser}/${repo}`;
}

function pagesUrl(repo) {
  return `https://${githubUser}.github.io/${repo}/`;
}

function projectDestination(project) {
  if (!project.repo && !project.htmlUrl) return "Unpublished";
  return project.demo ? pagesUrl(project.repo) : project.htmlUrl || projectUrl(project.repo);
}

function formatUtcTime(date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(-2);
  const hours24 = date.getUTCHours();
  const hours12 = String(hours24 % 12 || 12);
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  const period = hours24 >= 12 ? "PM" : "AM";
  return `${month}/${day}/${year} ${hours12}:${minutes}:${seconds} ${period} UTC`;
}

function updateMenuUtcTime() {
  menuUtcTime.textContent = formatUtcTime(new Date());
}

function sortProjectsByAutoId(items) {
  return items.slice().sort((a, b) => {
    const aId = Number(a.autoId);
    const bId = Number(b.autoId);
    const aHasNumber = Number.isFinite(aId);
    const bHasNumber = Number.isFinite(bId);
    if (aHasNumber && bHasNumber) return bId - aId;
    if (aHasNumber) return -1;
    if (bHasNumber) return 1;
    return String(a.name).localeCompare(String(b.name));
  });
}

function numericAutoId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function assignRepoAutoIds(repos) {
  const reservedIds = new Set(staticProjects.map((project) => numericAutoId(project.autoId)).filter(Boolean));
  const ids = {};
  let nextId = 1;

  repos
    .slice()
    .sort((a, b) => new Date(a.pushed_at || 0) - new Date(b.pushed_at || 0))
    .forEach((repo) => {
      while (reservedIds.has(nextId)) {
        nextId += 1;
      }
      ids[repo.id] = nextId;
      nextId += 1;
    });

  return ids;
}

projects = sortProjectsByAutoId(staticProjects);

function formatRepoUpdated(pushedAt) {
  if (!pushedAt) return "Unknown";
  const date = new Date(pushedAt);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function formatCommitDate(dateValue) {
  if (!dateValue) return "Unknown";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function normalizeRepo(repo) {
  const topics = Array.isArray(repo.topics) ? repo.topics : [];
  const tags = topics.length ? topics : repo.language ? [repo.language] : ["Repository"];
  const description = repo.description || "No description provided.";
  const type = repoTypeOverrides[repo.name] || "Repository";

  return {
    name: repo.name,
    type,
    updated: formatRepoUpdated(repo.pushed_at),
    stars: repo.stargazers_count || 0,
    languages: repo.language || "Repository",
    description,
    tags,
    status: repo.language || "Repository",
    publishStatus: repo.has_pages ? "Published" : "Repository Only",
    owner: githubUser,
    repo: repo.name,
    htmlUrl: repo.html_url,
    pushedAt: repo.pushed_at,
    demo: Boolean(repo.has_pages),
  };
}

function normalizeCommit(commit) {
  return {
    date: formatCommitDate(commit.isoDate),
    isoDate: commit.isoDate || "",
    note: commit.note,
    repo: commit.repo,
    repoUrl: commit.repoUrl,
    commitUrl: commit.commitUrl,
  };
}

async function loadGithubProjects() {
  try {
    const [repoData, staticData] = await Promise.all([
      fetch("repos.json").then((r) => r.json()),
      fetch("static-projects.json").then((r) => r.json()),
    ]);

    staticProjects = Array.isArray(staticData) ? staticData : [];

    const allRepos = Array.isArray(repoData.repos) ? repoData.repos : [];
    const ownedRepos = allRepos.filter((repo) => !repo.fork && !excludedRepoNames.has(repo.name));
    const autoIdByRepoId = assignRepoAutoIds(ownedRepos);

    projects = ownedRepos
      .sort((a, b) => new Date(b.pushed_at || 0) - new Date(a.pushed_at || 0))
      .map((repo) => ({ ...normalizeRepo(repo), autoId: autoIdByRepoId[repo.id] }))
      .concat(staticProjects);
    projects = sortProjectsByAutoId(projects);

    commits = Array.isArray(repoData.commits)
      ? repoData.commits
          .map(normalizeCommit)
          .sort((a, b) => new Date(b.isoDate || 0) - new Date(a.isoDate || 0))
          .slice(0, 30)
      : [];

    activeCategory = "All";
    renderSelects();
    renderFilterButtons();
    renderDashboard();
    renderCommitTable(commits);
    renderActivity(commits);
  } catch (error) {
    console.warn(error);
  }
}

function renderCommitTable(commits) {
  commitCount.textContent = `Matching ${commits.length} commits`;
  commitTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Note</th>
          <th>Repository</th>
        </tr>
      </thead>
      <tbody>
        ${
          commits.length
            ? commits
                .map(
                  (commit) => `
                    <tr>
                      <td>${commit.date}</td>
                      <td>
                        ${
                          commit.commitUrl
                            ? `<a href="${commit.commitUrl}" target="_blank" rel="noreferrer">${commit.note}</a>`
                            : commit.note
                        }
                      </td>
                      <td>
                        ${
                          commit.repoUrl
                            ? `<a href="${commit.repoUrl}" target="_blank" rel="noreferrer">${commit.repo}</a>`
                            : commit.repo
                        }
                      </td>
                    </tr>
                  `,
                )
                .join("")
            : `<tr><td colspan="3">No commits found.</td></tr>`
        }
      </tbody>
    </table>
  `;
}

function currentProjects() {
  const selectedPresent = presentSelect.value || "all";
  const selectedCategory = categorySelect.value || "All";
  const selectedStatus = statusSelect.value || "All";
  const searchTerm = searchInput.value.trim().toLowerCase();

  return projects.filter((project) => {
    const presentMatch = selectedPresent === "all" || projectMatchesYear(project, selectedPresent);
    const categoryMatch =
      activeCategory === "All" && selectedCategory === "All"
        ? true
        : project.languages === (activeCategory !== "All" ? activeCategory : selectedCategory);
    const statusMatch = selectedStatus === "All" || project.publishStatus === selectedStatus;
    const searchMatch =
      !searchTerm ||
      [project.name, project.repo, project.languages, project.description, project.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm);

    return presentMatch && categoryMatch && statusMatch && searchMatch;
  });
}

function dateYear(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return String(date.getUTCFullYear());
}

function commitYearsByRepo() {
  return commits.reduce((yearsByRepo, commit) => {
    const year = dateYear(commit.isoDate);
    if (!year || !commit.repo) return yearsByRepo;
    if (!yearsByRepo[commit.repo]) yearsByRepo[commit.repo] = new Set();
    yearsByRepo[commit.repo].add(year);
    return yearsByRepo;
  }, {});
}

function presentYears() {
  const years = new Set();
  projects.forEach((project) => {
    const year = dateYear(project.pushedAt);
    if (year) years.add(year);
  });
  commits.forEach((commit) => {
    const year = dateYear(commit.isoDate);
    if (year) years.add(year);
  });
  return [...years].sort((a, b) => Number(b) - Number(a));
}

function projectMatchesYear(project, selectedYear) {
  if (dateYear(project.pushedAt) === selectedYear) return true;
  const yearsByRepo = commitYearsByRepo();
  return Boolean(project.repo && yearsByRepo[project.repo]?.has(selectedYear));
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    counts[item[key]] = (counts[item[key]] || 0) + 1;
    return counts;
  }, {});
}

function tagCounts(items) {
  return items
    .flatMap((project) => project.tags)
    .reduce((counts, tag) => {
      counts[tag] = (counts[tag] || 0) + 1;
      return counts;
    }, {});
}

function renderSelects() {
  const selectedPresent = presentSelect.value || "all";
  const categories = ["All", ...new Set(projects.map((project) => project.languages))];
  const statuses = ["All", ...new Set(projects.map((project) => project.publishStatus))];
  const years = presentYears();

  presentSelect.innerHTML = [
    `<option value="all">All</option>`,
    ...years.map((year) => `<option value="${year}">${year}</option>`),
  ].join("");
  presentSelect.value = years.includes(selectedPresent) ? selectedPresent : "all";
  categorySelect.innerHTML = categories
    .map((category) => `<option value="${category}">${category === "All" ? "No Filter" : category}</option>`)
    .join("");
  statusSelect.innerHTML = statuses
    .map((status) => `<option value="${status}">${status === "All" ? "No Filter" : status}</option>`)
    .join("");
}

function renderFilterButtons() {
  const categories = ["All", ...new Set(projects.map((project) => project.languages))];
  filterRoot.innerHTML = categories
    .map(
      (category) => `
        <button
          class="filter-button"
          type="button"
          data-filter="${category}"
          aria-pressed="${category === activeCategory}"
        >
          ${category}
        </button>
      `,
    )
    .join("");
}

function renderBars(items) {
  const rows = Object.entries(countBy(items, "languages"))
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], index) => ({ label, value, color: colors[index % colors.length] }));
  const max = Math.max(...rows.map((row) => row.value), 1);
  const axisStep = max <= 4 ? 1 : Math.ceil(max / 3);
  const axisMax = max <= 4 ? max : Math.ceil(max / axisStep) * axisStep;
  const axisLabels = Array.from({ length: Math.floor(axisMax / axisStep) + 1 }, (_, index) => index * axisStep);
  const tickPercentages = axisLabels.map((label) => (axisMax ? (label / axisMax) * 100 : 0));

  document.querySelector("#categoryBars").innerHTML = `
    <div class="bar-axis">
      <span></span>
      <div class="bar-axis-scale">
        ${axisLabels.map((label) => `<span style="left:${axisMax ? (label / axisMax) * 100 : 0}%">${label}</span>`).join("")}
      </div>
      <span></span>
    </div>
    ${rows
      .map(
        (row) => `
          <div class="bar-row">
            <span>${row.label}</span>
            <div class="bar-track" style="--ticks:${tickPercentages.map((tick) => `#e5edf3 ${tick}% ${tick + 0.18}%`).join(",")}">
              <i style="width:${(row.value / axisMax) * 100}%;background:${row.color}"></i>
            </div>
          </div>
        `,
      )
      .join("")}
  `;
}

function renderPie(target, legendTarget, rows) {
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;
  let cursor = 0;
  const segments = rows.map((row, index) => {
    const start = cursor;
    cursor += (row.value / total) * 100;
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  });

  target.style.background = `conic-gradient(${segments.join(", ")})`;
  legendTarget.innerHTML = rows
    .map(
      (row, index) => `
        <div class="legend-row">
          <span><i style="background:${colors[index % colors.length]}"></i>${row.label}</span>
          <strong>${row.value}</strong>
        </div>
      `,
    )
    .join("");
}

function renderActivity(items) {
  const startYear = 2016;
  const currentYear = new Date().getUTCFullYear();
  const years = Array.from({ length: currentYear - startYear + 1 }, (_, index) => startYear + index);
  const updatesByYear = years.reduce((updates, year) => {
    updates[year] = 0;
    return updates;
  }, {});

  items.forEach((commit) => {
    const date = commit.isoDate ? new Date(commit.isoDate) : null;
    if (!date || Number.isNaN(date.getTime())) return;

    const year = date.getUTCFullYear();
    if (year >= startYear && year <= currentYear) {
      updatesByYear[year] += 1;
    }
  });

  const chartRows = years.map((year) => [String(year), { count: updatesByYear[year], label: String(year) }]);
  const points = chartRows.map(([, row]) => row.count);
  const max = Math.max(...points, 2);
  const step = chartRows.length > 1 ? 588 / (chartRows.length - 1) : 0;
  const coordinates = points
    .map((point, index) => {
      const x = chartRows.length > 1 ? 24 + index * step : 318;
      const y = 150 - (point / max) * 118;
      return `${x},${y}`;
    })
    .join(" ");
  const yearLabels = chartRows
    .map(([, row], index) => {
      const x = chartRows.length > 1 ? 24 + index * step : 318;
      return `<text x="${x}" y="180" text-anchor="middle">${row.label}</text>`;
    })
    .join("");

  document.querySelector("#activityChart").innerHTML = `
    <svg viewBox="0 0 640 190" role="img" aria-label="Project activity line chart">
      <g class="grid-lines">
        <line x1="24" y1="32" x2="612" y2="32"></line>
        <line x1="24" y1="72" x2="612" y2="72"></line>
        <line x1="24" y1="112" x2="612" y2="112"></line>
        <line x1="24" y1="152" x2="612" y2="152"></line>
      </g>
      <polyline points="${coordinates}"></polyline>
      ${points
        .map((point, index) => {
          const x = chartRows.length > 1 ? 24 + index * step : 318;
          const y = 150 - (point / max) * 118;
          return `<circle cx="${x}" cy="${y}" r="4"><title>${chartRows[index][1].label}: ${point}</title></circle>`;
        })
        .join("")}
      <g class="chart-labels">
        ${yearLabels}
      </g>
    </svg>
  `;
}

function renderEndpointTable(items) {
  document.querySelector("#endpointTable").innerHTML = `
    <table>
      <thead>
        <tr><th>Destination</th></tr>
      </thead>
      <tbody>
        ${items
          .map(
            (project) => `
              <tr>
                <td>${projectDestination(project)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderProjectTable(items) {
  matchCount.textContent = `Matching ${items.length} out of ${projects.length} projects`;
  projectTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>AutoID</th>
          <th>Type</th>
          <th>Updated</th>
          <th>Stars</th>
          <th>Languages</th>
          <th>Name</th>
          <th>Description</th>
          <th>Tags</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (project, index) => `
              <tr>
                <td>${project.autoId || index + 1}</td>
                <td>${project.type}</td>
                <td>${project.updated}</td>
                <td>${project.stars || 0}</td>
                <td>${project.languages}</td>
                <td>
                  ${
                    project.htmlUrl || project.repo
                      ? `<a href="${project.htmlUrl || projectUrl(project.repo)}" target="_blank" rel="noreferrer"><strong>${project.name}</strong></a>`
                      : `<strong>${project.name}</strong>`
                  }
                </td>
                <td>${project.description}</td>
                <td>${project.tags.join(", ")}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderDashboard() {
  const items = currentProjects();
  const projectTypeRows = Object.entries(countBy(items, "type")).map(([label, value]) => ({ label, value }));
  const publishingRows = Object.entries(countBy(items, "publishStatus")).map(([label, value]) => ({ label, value }));
  const techRows = Object.entries(tagCounts(items))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  renderBars(items);
  renderPie(document.querySelector("#categoryPie"), document.querySelector("#categoryLegend"), projectTypeRows);
  renderPie(document.querySelector("#statusPie"), document.querySelector("#statusLegend"), publishingRows);
  document.querySelector("#techLegend").innerHTML = techRows
    .map(
      (row, index) => `
        <div class="legend-row">
          <span><i style="background:${colors[index % colors.length]}"></i>${row.label}</span>
          <strong>${row.value}</strong>
        </div>
      `,
    )
    .join("");
  renderActivity(commits);
  renderEndpointTable(items);
  renderProjectTable(items);
}

filterRoot.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;

  activeCategory = button.dataset.filter;
  categorySelect.value = "All";
  renderFilterButtons();
  renderDashboard();
});

categorySelect.addEventListener("change", () => {
  activeCategory = "All";
  renderFilterButtons();
  renderDashboard();
});
presentSelect.addEventListener("change", renderDashboard);
statusSelect.addEventListener("change", renderDashboard);
searchInput.addEventListener("input", renderDashboard);
document.querySelector("#clearFilters").addEventListener("click", () => {
  activeCategory = "All";
  presentSelect.value = "all";
  categorySelect.value = "All";
  statusSelect.value = "All";
  searchInput.value = "";
  renderFilterButtons();
  renderDashboard();
});

function closeAppMenu() {
  appMenu.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  menuSearch.value = "";
  document.querySelectorAll("#menuDirectory section").forEach((section) => {
    section.hidden = false;
  });
}

function closeAccountMenu() {
  accountMenu.hidden = true;
  accountToggle.setAttribute("aria-expanded", "false");
}

menuButton.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  if (isOpen) {
    closeAppMenu();
    return;
  }

  closeAccountMenu();
  appMenu.hidden = false;
  menuButton.setAttribute("aria-expanded", "true");
  menuSearch.focus();
});

appMenu.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    closeAppMenu();
  }
});

accountToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = accountToggle.getAttribute("aria-expanded") === "true";
  closeAppMenu();
  accountMenu.hidden = isOpen;
  accountToggle.setAttribute("aria-expanded", String(!isOpen));
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".top-actions")) {
    closeAccountMenu();
  }
  if (
    !appMenu.hidden &&
    !event.target.closest("#appMenu") &&
    !event.target.closest(".menu-button")
  ) {
    closeAppMenu();
  }
});

menuSearch.addEventListener("input", () => {
  const searchTerm = menuSearch.value.trim().toLowerCase();
  document.querySelectorAll("#menuDirectory section").forEach((section) => {
    section.hidden = searchTerm && !section.textContent.toLowerCase().includes(searchTerm);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !appMenu.hidden) {
    closeAppMenu();
    menuButton.focus();
  }
  if (event.key === "Escape" && !accountMenu.hidden) {
    closeAccountMenu();
    accountToggle.focus();
  }
});

renderSelects();
renderFilterButtons();
renderDashboard();
renderCommitTable([]);
loadGithubProjects();
updateMenuUtcTime();
setInterval(updateMenuUtcTime, 1000);
