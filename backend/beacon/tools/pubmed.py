"""PubMed E-utils client. Used as an ADK FunctionTool by the PubMed agent."""
from __future__ import annotations

import xml.etree.ElementTree as ET

import httpx

from beacon.config import settings

ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


def search_pubmed(query: str, max_results: int = 5) -> dict:
    """Search PubMed and return a list of abstracts.

    Args:
        query: Free-text query (English). The caller should translate non-English claims
            into an English search string before calling.
        max_results: Number of abstracts to fetch (1-10).

    Returns:
        {"hits": [{"pmid", "title", "abstract", "year", "url"}, ...]}
    """
    max_results = max(1, min(int(max_results), 10))
    params = {
        "db": "pubmed",
        "term": query,
        "retmax": str(max_results),
        "retmode": "json",
        "sort": "relevance",
    }
    if settings.ncbi_api_key:
        params["api_key"] = settings.ncbi_api_key

    headers = {"User-Agent": settings.user_agent}

    with httpx.Client(timeout=15.0, headers=headers) as client:
        try:
            r = client.get(ESEARCH, params=params)
            r.raise_for_status()
            ids = r.json().get("esearchresult", {}).get("idlist", [])
            if not ids:
                return {"hits": []}

            fetch_params = {
                "db": "pubmed",
                "id": ",".join(ids),
                "rettype": "abstract",
                "retmode": "xml",
            }
            if settings.ncbi_api_key:
                fetch_params["api_key"] = settings.ncbi_api_key
            r = client.get(EFETCH, params=fetch_params)
            r.raise_for_status()
        except httpx.HTTPError as e:
            return {"hits": [], "error": f"pubmed_http_error: {e}"}

    try:
        root = ET.fromstring(r.text)
    except ET.ParseError as e:
        return {"hits": [], "error": f"pubmed_parse_error: {e}"}

    hits = []
    for art in root.findall(".//PubmedArticle"):
        pmid_el = art.find(".//PMID")
        title_el = art.find(".//ArticleTitle")
        abstract_parts = [
            (el.text or "") for el in art.findall(".//Abstract/AbstractText")
        ]
        year_el = art.find(".//PubDate/Year") or art.find(".//PubDate/MedlineDate")
        if pmid_el is None or title_el is None:
            continue
        pmid = pmid_el.text or ""
        year = None
        if year_el is not None and year_el.text:
            try:
                year = int(year_el.text[:4])
            except ValueError:
                year = None
        hits.append(
            {
                "pmid": pmid,
                "title": (title_el.text or "").strip(),
                "abstract": " ".join(p.strip() for p in abstract_parts if p).strip(),
                "year": year,
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            }
        )
    return {"hits": hits}
