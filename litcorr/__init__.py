"""Literotica Correlations — Stage 1 data pipeline.

Collection (``litcorr.collect``) is deliberately slow and conservative; every
later step (``build``, ``text``, ``analyze``) works offline from the local cache.
"""

__version__ = "0.1.0"
