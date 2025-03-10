---
title: Introduction
---


_Quacklytics_ is an open-source analytics service built using **DuckDB** and designed to run analytical queries directly inside
your browser. It provides a seamless, lightweight, and high-performance way to process your data without the need for
expensive server-side compute resources.


## Why does this exist?

I build Quacklytics to **save costs** while still having a powerful and fast analytics stack for my products.  

The tool is easy to self-host, cost-efficient and low-maintenance. 
It does not require extensive knowledge about databases or setting up complex data flows. 
Just send your analytics events to the events endpoint, and you're ready to go!

## Approach to data analytics

Quacklytics leverages the fact that modern computers, phones and laptop have very capable CPUs and sufficient memory.
In addition, broadband internet is reliable and fast. This combination allows us to download data and move heavy 
computations to the client side, instead of running everything on the server side.

## How Quacklytics helps you save costs

Cloud resources _can be expensive_. But that heavily depends on the provider you choose, and the type of resources 
your projects require. Quacklytics aims to be cost-efficient for self-hosting.
Storage itself is cheap and a structure of directories and files is very easy to maintain, scale, migrate and back-up. 
