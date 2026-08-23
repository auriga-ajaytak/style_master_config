# Copyright (c) 2022, Auriga and contributors
# For license information, please see license.txt


def validate(doc, event):
	"""Quotations here carry styles rather than items, so the standard item
	mandatory checks do not apply."""
	doc.flags.ignore_mandatory = True
