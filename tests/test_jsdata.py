from litcorr.site.jsdata import parse_js_data


def test_seroval_refs_booleans_and_nesting():
    s = ('_$HY.r["workData[\\"a-story\\"]"]=$R[0]=($R[1]=new Promise(r=>r),$R[2]={meta:$R[3]={pages_count:3},'
         'submission:$R[4]={allow_vote:!0,is_hot:!1,rate_all:4.61,view_count:23456,title:"A \\"quoted\\" title",'
         'url:"a-story",author:$R[5]={username:"W",userid:7},tags:$R[6]=[{tag:"x"},$R[7]={tag:"y"}]}});'
         '$R[8]($R[0],$R[9]={current_page:2,last_page:9,total:450,per_page:50,data:[]});')
    d = parse_js_data(s)
    sub = next(x for x in d.iter_dicts() if d.resolve(x.get("url")) == "a-story")
    assert sub["allow_vote"] is True and sub["is_hot"] is False
    assert sub["rate_all"] == 4.61 and sub["view_count"] == 23456
    assert sub["title"] == 'A "quoted" title'
    assert d.resolve(sub["author"])["username"] == "W"
    tags = d.materialize(sub["tags"])
    assert [t["tag"] for t in tags] == ["x", "y"]
    pager = next(x for x in d.iter_dicts() if "last_page" in x)
    assert pager["last_page"] == 9 and pager["total"] == 450
    assert any("workData" in k for k in d.named)


def test_escapes_dates_and_references():
    d = parse_js_data(r'$R[0]={a:"café \x3Cb\x3E",d:new Date("2024-01-31T00:00:00Z"),r:$R[1]={n:-1.5e2},'
                      r'm:new Map([["k",1]]),u:void 0,x:$R[1]}')
    root = d.roots[0]
    assert root["a"] == "café <b>"
    assert root["d"].startswith("2024-01-31")
    assert d.resolve(root["x"])["n"] == -150.0
    assert root["m"] == {"k": 1} and root["u"] is None


def test_tolerates_garbage_and_keeps_good_objects():
    d = parse_js_data("var f = function(){ return 1 }; window.x = {ok:1, bad: function(){}, also:2}; {broken: ;}")
    good = [x for x in d.iter_dicts() if x.get("ok") == 1]
    assert good and good[0]["also"] == 2 and good[0]["bad"] is None
