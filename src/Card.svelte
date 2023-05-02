<script>

</script>

<div class="card-back">
    <div class="card">
        <div class="inner-card">
            <slot></slot>
        </div>
    </div>
</div>

<style>
    .card {
        position: relative;
        display: inline-block;
        left: -95px;
    }

    .card .inner-card {
        color: white;
        font-family: Helvetica, sans-serif;
        font-weight: bold;
        text-align: center;
        text-decoration: none;
        background-color: white;
        display: block;
        position: relative;
        padding: 10px 10px;
        width: 410px;
        height: 100%;
        
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        text-shadow: 0px 1px 0px #000;
        

        
        -webkit-border-radius: 5px;
        -moz-border-radius: 5px;
        border-radius: 5px;
    }

    .card:after {
        content: "";
        height: 100%;
        width: 100%;
        padding: 4px;
        position: absolute;
        bottom: -15px;
        left: -4px;
        z-index: -1;
        background-color: #420000;
        -webkit-border-radius: 5px;
        -moz-border-radius: 5px;
        border-radius: 5px;
    }
</style>