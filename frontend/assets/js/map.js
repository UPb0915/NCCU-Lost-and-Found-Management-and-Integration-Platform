const BUILDING_AREAS = [
  {
    key: "social_science",
    name: "社資中心",
    aliases: ["社資中心", "社會科學資料中心"],
    left: 76.3,
    top: 31.4,
    width: 4.8,
    height: 8.2
  },
  {
    key: "jing_tang",
    name: "井塘樓",
    aliases: ["井塘樓"],
    left: 72.5,
    top: 37.8,
    width: 3.8,
    height: 7.2
  },
  {
    key: "law_school",
    name: "法學院",
    aliases: ["法學院", "憇賢樓", "憩賢樓"],
    left: 57.6,
    top: 31.8,
    width: 4.5,
    height: 5.8
  },
  {
    key: "xuesi",
    name: "學思樓",
    aliases: ["學思樓"],
    left: 53.0,
    top: 9.5,
    width: 3.2,
    height: 4.8
  },
  {
    key: "business_college",
    name: "商學院館",
    aliases: ["商院", "商學院", "商學院館", "商院館", "260"],
    left: 47.8,
    top: 15.5,
    width: 4.5,
    height: 11.0
  },
  {
    key: "yixian",
    name: "逸仙樓",
    aliases: ["逸仙樓"],
    left: 53.0,
    top: 15.8,
    width: 3.8,
    height: 10.2
  },
  {
    key: "library",
    name: "中正圖書館",
    aliases: ["中正圖書館", "圖書館"],
    left: 47.2,
    top: 38.2,
    width: 7.4,
    height: 9.5
  },
  {
    key: "zhixi",
    name: "志希樓",
    aliases: ["志希樓"],
    left: 45.8,
    top: 17.0,
    width: 3.0,
    height: 7.2
  },
  {
    key: "guofu",
    name: "果夫樓",
    aliases: ["果夫樓"],
    left: 40.3,
    top: 17.2,
    width: 3.8,
    height: 7.2
  },
  {
    key: "siwei",
    name: "四維堂",
    aliases: ["四維堂"],
    left: 40.6,
    top: 35.5,
    width: 4.5,
    height: 13.2
  },
  {
    key: "lohas",
    name: "樂活",
    aliases: ["樂活", "倉庫"],
    left: 32.2,
    top: 8.1,
    width: 8.4,
    height: 5.4
  },
  {
    key: "information",
    name: "資訊大樓",
    aliases: ["資訊大樓", "電算中心"],
    left: 29.6,
    top: 17.7,
    width: 6.2,
    height: 7.5
  },
  {
    key: "health_center",
    name: "健康中心",
    aliases: ["健康中心"],
    left: 46.5,
    top: 1.8,
    width: 4.2,
    height: 3.6
  },
  {
    key: "administration",
    name: "行政大樓",
    aliases: ["行政大樓"],
    left: 34.1,
    top: 35.6,
    width: 5.7,
    height: 10.8
  },
  {
    key: "jiying",
    name: "集英樓",
    aliases: ["集英樓"],
    left: 24.1,
    top: 14.4,
    width: 4.6,
    height: 7.2
  },
  {
    key: "journalism",
    name: "新聞館",
    aliases: ["新聞館"],
    left: 21.0,
    top: 18.2,
    width: 5.1,
    height: 6.6
  },
  {
    key: "dazhi",
    name: "大智樓",
    aliases: ["大智樓"],
    left: 13.2,
    top: 13.8,
    width: 5.2,
    height: 4.4
  },
  {
    key: "dayong",
    name: "大勇樓",
    aliases: ["大勇樓"],
    left: 13.0,
    top: 30.9,
    width: 11.6,
    height: 6.4
  },
  {
    key: "swimming_pool",
    name: "游泳池",
    aliases: ["游泳池"],
    left: 58.2,
    top: 43.2,
    width: 5.5,
    height: 5.8
  },
  {
    key: "gym",
    name: "體育館",
    aliases: ["體育館"],
    left: 21.0,
    top: 67.0,
    width: 8.4,
    height: 10.5
  },
  {
    key: "research",
    name: "研究大樓",
    aliases: ["研究大樓"],
    left: 47.7,
    top: 7.1,
    width: 4.4,
    height: 7.3
  },
  {
    key: "zonghe_north",
    name: "綜合院館北棟",
    aliases: ["綜合院館北棟", "綜合院館", "綜院北棟"],
    left: 16.6,
    top: 31.7,
    width: 4.7,
    height: 7.2
  },
  {
    key: "zonghe_south",
    name: "綜合院館南棟",
    aliases: ["綜合院館南棟", "綜院南棟"],
    left: 15.7,
    top: 43.5,
    width: 4.5,
    height: 7.8
  },
  {
    key: "zhuangjing_1",
    name: "莊敬一舍",
    aliases: ["莊敬一舍"],
    left: 58.1,
    top: 10.5,
    width: 4.4,
    height: 7.4
  },
  {
    key: "zhuangjing_2",
    name: "莊敬二舍",
    aliases: ["莊敬二舍"],
    left: 61.8,
    top: 8.5,
    width: 4.3,
    height: 4.8
  },
  {
    key: "zhuangjing_3",
    name: "莊敬三舍",
    aliases: ["莊敬三舍"],
    left: 65.2,
    top: 8.4,
    width: 4.0,
    height: 4.7
  },
  {
    key: "zhuangjing_9",
    name: "莊敬九舍",
    aliases: ["莊敬九舍"],
    left: 66.2,
    top: 20.0,
    width: 9.7,
    height: 6.3
  },
  {
    key: "track_field",
    name: "操場",
    aliases: ["操場", "田徑場"],
    left: 22.7,
    top: 39.8,
    width: 14.2,
    height: 24.0
  }
];

function renderMapPins(reports) {
  const visibleReports = reports.filter(shouldShowReportOnMap);

  renderBuildingAreas(visibleReports);

  const mapPins = document.getElementById("mapPins");
  mapPins.innerHTML = "";

  const groupedReports = groupReportsByArea(visibleReports);

  visibleReports.forEach(report => {
    const area = findBuildingAreaByLocation(`${report.location_name || ""} ${report.building || ""} ${report.note || ""}`);

    let position;

    if (area) {
      const group = groupedReports[area.key] || [];
      const index = group.findIndex(item => String(item.report_id) === String(report.report_id));
      position = getDistributedPosition(area, index, group.length);
    } else {
      position = {
        x: report.map_x || 50,
        y: report.map_y || 50
      };
    }

    const pin = document.createElement("div");
    pin.className = "map-pin";
    pin.style.left = `${position.x}%`;
    pin.style.top = `${position.y}%`;
    pin.title = `${report.item_name}｜${report.location_name}`;
    pin.textContent = report.type === "F" ? "拾" : "遺";

    pin.addEventListener("click", (event) => {
      event.stopPropagation();
      showDetailView(report);
    });

    mapPins.appendChild(pin);
  });
}

function shouldShowReportOnMap(report) {
  if (!report) {
    return false;
  }

  if (report.deleted_at) {
    return false;
  }

  if (report.type === "F") {
    return report.status === "待認領";
  }

  if (report.type === "L") {
    return report.status === "待處理";
  }

  return false;
}

function normalizeLocationText(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function findBuildingAreaByLocation(locationText) {
  const normalized = normalizeLocationText(locationText);

  if (!normalized) {
    return null;
  }

  return BUILDING_AREAS.find((area) => {
    return area.aliases.some((alias) => {
      const normalizedAlias = normalizeLocationText(alias);
      return normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized);
    });
  }) || null;
}

function renderBuildingAreas(reports) {
  const mapRegions = document.getElementById("mapRegions");

  if (!mapRegions) {
    return;
  }

  mapRegions.innerHTML = "";

  BUILDING_AREAS.forEach(area => {
    const relatedReports = reports.filter(report => {
      const matchedArea = findBuildingAreaByLocation(`${report.location_name || ""} ${report.building || ""} ${report.note || ""}`);
      return matchedArea && matchedArea.key === area.key;
    });

    const regionEl = document.createElement("div");
    regionEl.className = "map-region";
    regionEl.style.left = `${area.left}%`;
    regionEl.style.top = `${area.top}%`;
    regionEl.style.width = `${area.width}%`;
    regionEl.style.height = `${area.height}%`;

    regionEl.innerHTML = `
      <span class="map-region-label">
        ${area.name}｜${relatedReports.length} 筆通報
      </span>
    `;

    regionEl.addEventListener("click", () => {
      showBuildingMapView(area, relatedReports);
    });

    mapRegions.appendChild(regionEl);
  });
}

function groupReportsByArea(reports) {
  const grouped = {};

  reports.forEach(report => {
    const area = findBuildingAreaByLocation(`${report.location_name || ""} ${report.building || ""} ${report.note || ""}`);

    if (!area) {
      return;
    }

    if (!grouped[area.key]) {
      grouped[area.key] = [];
    }

    grouped[area.key].push(report);
  });

  return grouped;
}

function getDistributedPosition(area, index, total) {
  if (total <= 1) {
    return {
      x: area.left + area.width / 2,
      y: area.top + area.height / 2
    };
  }

  const cols = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / cols);

  const col = index % cols;
  const row = Math.floor(index / cols);

  const xGap = area.width / (cols + 1);
  const yGap = area.height / (rows + 1);

  return {
    x: area.left + xGap * (col + 1),
    y: area.top + yGap * (row + 1)
  };
}