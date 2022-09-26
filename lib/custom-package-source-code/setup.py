### Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
### SPDX-License-Identifier: MIT-0

"""A setuptools based setup module.
See:
https://packaging.python.org/en/latest/distributing.html
"""

from setuptools import setup, find_packages

setup(
    name = 'mypippackage',

    version = '1.0.0',

    description = 'An sample Python package',
    license = 'MIT',
    package_dir = {"": "customPackages"},
    packages = find_packages(where="customPackages"),
    python_requires = '>=3.6'

)