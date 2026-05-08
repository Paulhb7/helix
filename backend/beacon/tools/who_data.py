"""Curated WHO/CDC mythbuster snippets.

Why curated? WHO/CDC do not expose a clean machine-readable API for fact sheets
or COVID-19 mythbusters. Embedding a small, citable, hand-curated list keeps
the agent honest (no scraping fragility) and works fully offline. Extend as
needed; each entry must keep an authoritative URL.
"""
from __future__ import annotations

WHO_MYTHS: list[dict] = [
    {
        "id": "who-covid-5g",
        "topic": "covid",
        "myth": "5G mobile networks spread COVID-19.",
        "fact": "Viruses cannot travel on radio waves or mobile networks. COVID-19 spreads "
        "through respiratory droplets and aerosols.",
        "url": "https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters",
        "source_type": "mythbuster",
    },
    {
        "id": "who-covid-vaccines-dna",
        "topic": "vaccines",
        "myth": "COVID-19 mRNA vaccines change human DNA.",
        "fact": "mRNA vaccines do not enter the cell nucleus and cannot alter DNA.",
        "url": "https://www.who.int/news-room/feature-stories/detail/how-do-vaccines-work",
        "source_type": "mythbuster",
    },
    {
        "id": "who-cancer-sugar",
        "topic": "oncology",
        "myth": "Sugar feeds cancer cells; cutting dietary sugar starves tumours.",
        "fact": "All cells, including healthy ones, use glucose. There is no clinical "
        "evidence that reducing dietary sugar slows tumour growth in patients. WHO "
        "guidance frames sugar intake around obesity and dental caries, not cancer "
        "causation.",
        "url": "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
        "source_type": "guideline",
    },
    {
        "id": "who-cancer-lemon",
        "topic": "oncology",
        "myth": "Drinking lemon water cures cancer.",
        "fact": "No food, drink, or supplement has been shown to cure cancer. "
        "Lemon is not a recognised treatment for any malignancy.",
        "url": "https://www.who.int/news-room/fact-sheets/detail/cancer",
        "source_type": "guideline",
    },
    {
        "id": "who-vaccines-autism",
        "topic": "vaccines",
        "myth": "Vaccines cause autism.",
        "fact": "Multiple large-scale studies have found no link between vaccines and "
        "autism. The original 1998 paper suggesting a link was retracted.",
        "url": "https://www.who.int/news-room/questions-and-answers/item/vaccines-and-immunization-myths-and-misconceptions",
        "source_type": "mythbuster",
    },
    {
        "id": "who-hydroxychloroquine",
        "topic": "covid",
        "myth": "Hydroxychloroquine prevents or cures COVID-19.",
        "fact": "WHO recommends against the use of hydroxychloroquine to treat or "
        "prevent COVID-19 based on evidence from large randomised trials.",
        "url": "https://www.who.int/news/item/17-06-2020-q-a-hydroxychloroquine-and-covid-19",
        "source_type": "guideline",
    },
    {
        "id": "who-ivermectin-covid",
        "topic": "covid",
        "myth": "Ivermectin is an effective treatment for COVID-19.",
        "fact": "WHO recommends against ivermectin in COVID-19 patients except in "
        "clinical trials. Evidence does not support a clinical benefit.",
        "url": "https://www.who.int/news-room/feature-stories/detail/who-advises-that-ivermectin-only-be-used-to-treat-covid-19-within-clinical-trials",
        "source_type": "guideline",
    },
    {
        "id": "who-bleach-covid",
        "topic": "covid",
        "myth": "Drinking bleach or disinfectant kills the coronavirus inside the body.",
        "fact": "Drinking bleach is dangerous and can be fatal. It does not protect "
        "against or treat COVID-19.",
        "url": "https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters",
        "source_type": "mythbuster",
    },
    {
        "id": "who-vit-c-cold",
        "topic": "nutrition",
        "myth": "High-dose vitamin C prevents the common cold.",
        "fact": "Routine vitamin C supplementation does not reduce the incidence of "
        "the common cold in the general population. It may modestly shorten duration.",
        "url": "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
        "source_type": "guideline",
    },
    {
        "id": "who-detox",
        "topic": "nutrition",
        "myth": "Juice cleanses or 'detox' diets remove toxins from the body.",
        "fact": "The liver and kidneys clear metabolic waste continuously. There is "
        "no clinical evidence that juice cleanses provide a detoxification benefit.",
        "url": "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
        "source_type": "guideline",
    },
]
