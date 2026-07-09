from pathlib import Path

from setuptools import find_packages, setup


ROOT = Path(__file__).parent


setup(
    name="slides-thief",
    version="0.1.0",
    description="Flatten photographed presentation slides and export them as PDF.",
    long_description=(ROOT / "README.md").read_text(encoding="utf-8"),
    long_description_content_type="text/markdown",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[
        "numpy>=1.24",
        "Pillow>=10",
        "reportlab>=4",
    ],
    entry_points={
        "console_scripts": [
            "slides-thief=slides_thief.cli:main",
            "slides-thief-web=slides_thief.web:main",
        ],
    },
)
